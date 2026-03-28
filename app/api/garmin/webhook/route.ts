export const dynamic = 'force-dynamic';

import { handleActivitySummary } from '@/lib/garmin-events/handleActivitySummary';
import { handleActivityDetail } from '@/lib/garmin-events/handleActivityDetail';
import { handleActivityFile } from '@/lib/garmin-events/handleActivityFile';
import { handlePermissionChange } from '@/lib/garmin-events/handlePermissionChange';
import { handleDeregistration } from '@/lib/garmin-events/handleDeregistration';

const DEBUG = process.env.GARMIN_DEBUG === 'true';

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

function safeRun(label: string, fn: () => unknown): void {
  void (async () => {
    try {
      await fn();
    } catch (err: unknown) {
      console.error(`[GARMIN WEBHOOK] ${label}:`, err);
    }
  })();
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
  void processWebhookSafely(rawText);
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
  void processWebhookSafely(rawText);
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
    const firstActivityUserId =
      firstActivity &&
      typeof firstActivity === 'object' &&
      firstActivity !== null &&
      'userId' in firstActivity
        ? String((firstActivity as { userId?: unknown }).userId ?? '')
        : null;
    const userIdLog = topLevelUserId ?? firstActivityUserId ?? '(none)';

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
      safeRun('handlePingActivities', async () => {
        await handlePingActivities(activities as any, body.userId as string | undefined);
      });
      return;
    }

    const category = detectGarminEvent(body);
    console.log('[GARMIN DETECT]', { category, userId: userIdLog });

    if (category === 'PERMISSION') {
      safeRun('handlePermissionChange', async () => {
        await handlePermissionChange({
          userId: body.userId as string | undefined,
          permissions: body.permissions as Parameters<typeof handlePermissionChange>[0]['permissions'],
          scopes: body.scopes as Parameters<typeof handlePermissionChange>[0]['scopes'],
          ...body,
        } as Parameters<typeof handlePermissionChange>[0]);
      });
      return;
    }

    if (category === 'DEREGISTRATION') {
      safeRun('handleDeregistration', async () => {
        await handleDeregistration({
          userId: body.userId as string | undefined,
          reason: body.reason as string | undefined,
          ...body,
        } as Parameters<typeof handleDeregistration>[0]);
      });
      return;
    }

    void dispatchLegacyEventType(body);
  } catch (error: unknown) {
    console.error('❌ [GARMIN WEBHOOK] processWebhookSafely:', error);
  }
}

/**
 * Legacy eventType routing for ACTIVITY / WORKOUT / UNKNOWN.
 */
async function dispatchLegacyEventType(body: Record<string, unknown>): Promise<void> {
  const eventType = detectEventTypeSafe(body);

  if (DEBUG) {
    console.log(`🔍 Detected legacy event type: ${eventType}`);
  }

  switch (eventType) {
    case 'ACTIVITY_SUMMARY':
      safeRun('handleActivitySummary', async () => {
        const acts = Array.isArray(body.activities) ? body.activities : [];
        const result = await handleActivitySummary(acts as any, body.userId as string | undefined);
        console.log('📩 Garmin ACTIVITY_SUMMARY result', {
          ...result,
          userId: body.userId ?? '(none)',
        });
      });
      break;

    case 'ACTIVITY_DETAIL':
      safeRun('handleActivityDetail', async () => {
        await handleActivityDetail(
          (Array.isArray(body.activityDetails) ? body.activityDetails : []) as any,
          body.userId as string | undefined
        );
      });
      break;

    case 'ACTIVITY_FILE':
      safeRun('handleActivityFile', async () => {
        await handleActivityFile(
          (Array.isArray(body.activityFiles) ? body.activityFiles : []) as any,
          body.userId as string | undefined
        );
      });
      break;

    case 'USER_PERMISSION_CHANGED':
      safeRun('handlePermissionChange(legacy)', async () => {
        await handlePermissionChange({
          userId: body.userId as string | undefined,
          permissions: body.permissions as Parameters<typeof handlePermissionChange>[0]['permissions'],
          scopes: body.scopes as Parameters<typeof handlePermissionChange>[0]['scopes'],
          ...body,
        } as Parameters<typeof handlePermissionChange>[0]);
      });
      break;

    case 'USER_DEREGISTER':
      safeRun('handleDeregistration(legacy)', async () => {
        await handleDeregistration({
          userId: body.userId as string | undefined,
          reason: body.reason as string | undefined,
          ...body,
        } as Parameters<typeof handleDeregistration>[0]);
      });
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
      if (
        Array.isArray(body.activities) &&
        body.activities.length > 0
      ) {
        safeRun('handleActivitySummary(MANUALLY_UPDATED)', async () => {
          await handleActivitySummary(body.activities as any, body.userId as string | undefined);
        });
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
