export const dynamic = 'force-dynamic';

import { waitUntil } from '@vercel/functions';
import { handleActivitySummary } from '@/lib/garmin-events/handleActivitySummary';
import { handleActivityDetail } from '@/lib/garmin-events/handleActivityDetail';
import { handleActivityFile } from '@/lib/garmin-events/handleActivityFile';
import { handlePermissionChange } from '@/lib/garmin-events/handlePermissionChange';
import { handleDeregistration } from '@/lib/garmin-events/handleDeregistration';

const DEBUG = process.env.GARMIN_DEBUG === 'true';

function readUserIdFromObject(item: unknown): string | null {
  if (item !== null && typeof item === 'object' && 'userId' in item) {
    const u = (item as { userId?: unknown }).userId;
    if (u !== undefined && u !== null && String(u).length > 0) {
      return String(u);
    }
  }
  return null;
}

/** Garmin userId may live on the body, or on the first activities / activityDetails / activityFiles item. */
function resolveGarminUserIdFromBody(body: Record<string, unknown>): string | null {
  if (body.userId !== undefined && body.userId !== null && String(body.userId).length > 0) {
    return String(body.userId);
  }
  const acts = body.activities;
  if (Array.isArray(acts) && acts.length > 0) {
    const u = readUserIdFromObject(acts[0]);
    if (u) return u;
  }
  const details = body.activityDetails;
  if (Array.isArray(details) && details.length > 0) {
    const u = readUserIdFromObject(details[0]);
    if (u) return u;
  }
  const files = body.activityFiles;
  if (Array.isArray(files) && files.length > 0) {
    const u = readUserIdFromObject(files[0]);
    if (u) return u;
  }
  return null;
}

type GarminWebhookCategory =
  | 'ACTIVITY'
  | 'WORKOUT'
  | 'PERMISSION'
  | 'DEREGISTRATION'
  | 'UNKNOWN';

/**
 * Classifies a normalized webhook body. Never throws.
 * (Not exported: Next.js route modules may only export HTTP method handlers.)
 */
function detectGarminEvent(body: Record<string, unknown>): GarminWebhookCategory {
  try {
    const activities = body.activities;
    const hasActivitiesArray = Array.isArray(activities) && activities.length > 0;
    const firstActivity = hasActivitiesArray ? (activities as unknown[])[0] : null;
    const isPing =
      firstActivity !== null &&
      typeof firstActivity === 'object' &&
      firstActivity !== null &&
      'callbackURL' in firstActivity &&
      Boolean((firstActivity as { callbackURL?: unknown }).callbackURL);

    if (hasActivitiesArray && isPing) return 'ACTIVITY';
    if (hasActivitiesArray) return 'ACTIVITY';

    const details = body.activityDetails;
    const files = body.activityFiles;
    if (Array.isArray(details) && details.length > 0) return 'ACTIVITY';
    if (Array.isArray(files) && files.length > 0) return 'ACTIVITY';

    if (body.activityId != null && body.activityId !== '') return 'ACTIVITY';
    if (body.workoutId != null && body.workoutId !== '') return 'WORKOUT';

    const et = body.eventType;
    if (typeof et === 'string') {
      const u = et.toUpperCase();
      if (
        u === 'USER_PERMISSION_CHANGED' ||
        u === 'CONSUMER_PERMISSIONS' ||
        u.includes('PERMISSION')
      ) {
        return 'PERMISSION';
      }
      if (u === 'USER_DEREGISTER' || u.includes('DEREGISTER')) {
        return 'DEREGISTRATION';
      }
      if (
        [
          'ACTIVITY_SUMMARY',
          'ACTIVITY_DETAIL',
          'ACTIVITY_FILE',
          'MANUALLY_UPDATED',
          'MOVEIQ',
        ].includes(u)
      ) {
        return 'ACTIVITY';
      }
    }

    if (body.reason === 'USER_DEREGISTER' || body.action === 'deregister') {
      return 'DEREGISTRATION';
    }
    if (body.permissions != null || body.scopes != null) return 'PERMISSION';

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function parseJsonSafe(rawText: string): unknown {
  try {
    const t = rawText?.trim() ?? '';
    if (!t) return {};
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function normalizeParsedToObject(parsed: unknown): Record<string, unknown> {
  try {
    if (parsed === null || typeof parsed !== 'object') return {};
    if (Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readRawBody(request: Request): Promise<string> {
  return request.text().catch(() => '');
}

/**
 * POST /api/garmin/webhook — partner verification safe (always 200 OK).
 */
export async function POST(request: Request) {
  console.log('📩 Garmin webhook POST received', {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get('content-type') ?? 'none',
  });

  const rawText = await readRawBody(request);
  waitUntil(processWebhookSafely(rawText));
  return new Response('OK', { status: 200 });
}

/**
 * PUT /api/garmin/webhook — same as POST (Garmin may use PUT).
 */
export async function PUT(request: Request) {
  console.log('📩 Garmin webhook PUT received', {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get('content-type') ?? 'none',
  });

  const rawText = await readRawBody(request);
  waitUntil(processWebhookSafely(rawText));
  return new Response('OK', { status: 200 });
}

/**
 * Background processing: must not affect HTTP; errors logged only.
 */
async function processWebhookSafely(rawText: string): Promise<void> {
  try {
    console.log('[GARMIN RAW]', rawText.slice(0, 500));

    const parsed = parseJsonSafe(rawText);
    const body = normalizeParsedToObject(parsed);

    const activities = body.activities;
    const hasActivitiesArray = Array.isArray(activities) && activities.length > 0;
    const firstActivity = hasActivitiesArray ? (activities as unknown[])[0] : null;
    const isPing =
      firstActivity !== null &&
      typeof firstActivity === 'object' &&
      firstActivity !== null &&
      'callbackURL' in firstActivity &&
      Boolean((firstActivity as { callbackURL?: unknown }).callbackURL);

    const topLevelUserId =
      body.userId !== undefined && body.userId !== null ? String(body.userId) : null;
    const firstActivityUserId = readUserIdFromObject(firstActivity);
    const garminUserId = resolveGarminUserIdFromBody(body);
    const userIdLog = garminUserId ?? '(none)';

    let keys: string[] = [];
    try {
      keys = Object.keys(body);
    } catch {
      keys = [];
    }

    console.log('📩 Garmin webhook payload', {
      keys,
      activitiesCount: hasActivitiesArray ? (activities as unknown[]).length : 0,
      mode: isPing ? 'PING (callbackURL)' : hasActivitiesArray ? 'PUSH (inline)' : 'none',
      userId: userIdLog,
      hasBodyUserId: topLevelUserId != null,
      hasFirstActivityUserId: firstActivityUserId != null,
      timestamp: new Date().toISOString(),
    });

    if (DEBUG) {
      try {
        console.log('📩 Garmin webhook body:', JSON.stringify(body, null, 2));
      } catch {
        /* ignore */
      }
    }

    if (hasActivitiesArray && isPing) {
      try {
        await handlePingActivities(
          activities as any,
          (body.userId as string | undefined) ?? garminUserId ?? undefined
        );
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handlePingActivities:', err);
      }
      return;
    }

    const category = detectGarminEvent(body);
    console.log('[GARMIN DETECT]', { category, userId: userIdLog });

    if (category === 'PERMISSION') {
      try {
        await handlePermissionChange({
          userId: (body.userId as string | undefined) ?? garminUserId ?? undefined,
          permissions: body.permissions as Parameters<typeof handlePermissionChange>[0]['permissions'],
          scopes: body.scopes as Parameters<typeof handlePermissionChange>[0]['scopes'],
          ...body,
        } as Parameters<typeof handlePermissionChange>[0]);
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handlePermissionChange:', err);
      }
      return;
    }

    if (category === 'DEREGISTRATION') {
      try {
        await handleDeregistration({
          userId: (body.userId as string | undefined) ?? garminUserId ?? undefined,
          reason: body.reason as string | undefined,
          ...body,
        } as Parameters<typeof handleDeregistration>[0]);
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handleDeregistration:', err);
      }
      return;
    }

    await dispatchLegacyEventType(body, garminUserId);
  } catch (error: unknown) {
    console.error('❌ [GARMIN WEBHOOK] processWebhookSafely:', error);
  }
}

/**
 * Legacy eventType routing for ACTIVITY / WORKOUT / UNKNOWN.
 * Awaited so waitUntil(processWebhookSafely) keeps the function alive until DB work finishes.
 */
async function dispatchLegacyEventType(
  body: Record<string, unknown>,
  garminUserId: string | null
): Promise<void> {
  const eventType = detectEventTypeSafe(body);
  const userIdParam = (body.userId as string | undefined) ?? garminUserId ?? undefined;

  if (DEBUG) {
    console.log(`🔍 Detected legacy event type: ${eventType}`);
  }

  switch (eventType) {
    case 'ACTIVITY_SUMMARY': {
      const acts = Array.isArray(body.activities) ? body.activities : [];
      try {
        const result = await handleActivitySummary(acts as any, userIdParam);
        console.log('📩 Garmin ACTIVITY_SUMMARY result', {
          ...result,
          userId: garminUserId ?? '(none)',
        });
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handleActivitySummary:', err);
      }
      break;
    }

    case 'ACTIVITY_DETAIL': {
      try {
        const result = await handleActivityDetail(
          (Array.isArray(body.activityDetails) ? body.activityDetails : []) as any,
          userIdParam
        );
        console.log('📩 Garmin ACTIVITY_DETAIL result', {
          ...result,
          userId: garminUserId ?? '(none)',
        });
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handleActivityDetail:', err);
      }
      break;
    }

    case 'ACTIVITY_FILE': {
      try {
        const result = await handleActivityFile(
          (Array.isArray(body.activityFiles) ? body.activityFiles : []) as any,
          userIdParam
        );
        console.log('📩 Garmin ACTIVITY_FILE result', {
          ...result,
          userId: garminUserId ?? '(none)',
        });
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handleActivityFile:', err);
      }
      break;
    }

    case 'USER_PERMISSION_CHANGED':
      try {
        await handlePermissionChange({
          userId: userIdParam,
          permissions: body.permissions as Parameters<typeof handlePermissionChange>[0]['permissions'],
          scopes: body.scopes as Parameters<typeof handlePermissionChange>[0]['scopes'],
          ...body,
        } as Parameters<typeof handlePermissionChange>[0]);
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handlePermissionChange(legacy):', err);
      }
      break;

    case 'USER_DEREGISTER':
      try {
        await handleDeregistration({
          userId: userIdParam,
          reason: body.reason as string | undefined,
          ...body,
        } as Parameters<typeof handleDeregistration>[0]);
      } catch (err: unknown) {
        console.error('[GARMIN WEBHOOK] handleDeregistration(legacy):', err);
      }
      break;

    case 'MOVEIQ':
      if (DEBUG) {
        try {
          console.log('📊 MoveIQ event received:', body);
        } catch {
          /* ignore */
        }
      }
      break;

    case 'MANUALLY_UPDATED':
      if (Array.isArray(body.activities) && body.activities.length > 0) {
        try {
          const result = await handleActivitySummary(body.activities as any, userIdParam);
          console.log('📩 Garmin ACTIVITY_SUMMARY result (MANUALLY_UPDATED)', {
            ...result,
            userId: garminUserId ?? '(none)',
          });
        } catch (err: unknown) {
          console.error('[GARMIN WEBHOOK] handleActivitySummary(MANUALLY_UPDATED):', err);
        }
      }
      break;

    default:
      try {
        console.warn('❓ Unknown webhook event type:', eventType, {
          keys: Object.keys(body),
        });
      } catch {
        /* ignore */
      }
  }
}

/**
 * Legacy string event type with string guard and safe structural inference.
 */
function detectEventTypeSafe(body: Record<string, unknown>): string {
  try {
    const et = body.eventType;
    if (typeof et === 'string') {
      const eventType = et.toUpperCase();
      if (eventType === 'CONSUMER_PERMISSIONS') {
        return 'USER_PERMISSION_CHANGED';
      }
      if (
        [
          'ACTIVITY_SUMMARY',
          'ACTIVITY_DETAIL',
          'ACTIVITY_FILE',
          'USER_PERMISSION_CHANGED',
          'USER_DEREGISTER',
          'MOVEIQ',
          'MANUALLY_UPDATED',
        ].includes(eventType)
      ) {
        return eventType;
      }
    }

    const acts = body.activities;
    if (Array.isArray(acts) && acts.length > 0) {
      return 'ACTIVITY_SUMMARY';
    }

    const details = body.activityDetails;
    if (Array.isArray(details) && details.length > 0) {
      return 'ACTIVITY_DETAIL';
    }

    const files = body.activityFiles;
    if (Array.isArray(files) && files.length > 0) {
      return 'ACTIVITY_FILE';
    }

    if (body.permissions != null || body.scopes != null) {
      return 'USER_PERMISSION_CHANGED';
    }

    if (body.reason === 'USER_DEREGISTER' || body.action === 'deregister') {
      return 'USER_DEREGISTER';
    }

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

async function handlePingActivities(
  activities: Array<{ userId?: string; callbackURL?: string }>,
  userId?: string
): Promise<void> {
  try {
    const garminUserId = userId ?? activities[0]?.userId;
    if (!garminUserId) {
      console.warn('⚠️ Garmin PING: no userId in payload or activities');
      return;
    }

    const allFetched: unknown[] = [];
    for (const item of activities) {
      const url = item?.callbackURL;
      if (!url) continue;
      try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
          console.warn(`⚠️ Garmin PING fetch failed: ${res.status} ${url.slice(0, 80)}...`);
          continue;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          allFetched.push(...data);
        } else if (data && typeof data === 'object') {
          allFetched.push(data);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ Garmin PING fetch error:', msg, url?.slice(0, 80));
      }
    }

    if (allFetched.length === 0) {
      console.log('📩 Garmin PING: no activity data returned from callbackURLs');
      return;
    }

    const result = await handleActivitySummary(allFetched as any, garminUserId);
    console.log('📩 Garmin PING processed', { fetched: allFetched.length, ...result });
  } catch (err: unknown) {
    console.error('❌ Garmin PING handler error:', err);
  }
}
