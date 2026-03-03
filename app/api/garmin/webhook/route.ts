export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { handleActivitySummary } from '@/lib/garmin-events/handleActivitySummary';
import { handleActivityDetail } from '@/lib/garmin-events/handleActivityDetail';
import { handleActivityFile } from '@/lib/garmin-events/handleActivityFile';
import { handlePermissionChange } from '@/lib/garmin-events/handlePermissionChange';
import { handleDeregistration } from '@/lib/garmin-events/handleDeregistration';

const DEBUG = process.env.GARMIN_DEBUG === 'true';

/**
 * POST /api/garmin/webhook
 *
 * Unified webhook endpoint for all Garmin events.
 * Responds with 200 OK immediately (<3 seconds), then processes asynchronously.
 *
 * To see if Garmin is sending: check server logs for "Garmin webhook POST received".
 * Set GARMIN_DEBUG=true for full payload logging.
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  // Log immediately so we can see in Vercel/server logs whether Garmin is hitting this endpoint at all
  console.log('📩 Garmin webhook POST received', {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get('content-type') ?? 'none',
  });

  // 1. Acknowledge Garmin immediately (required for webhook compliance)
  const acknowledgeResponse = NextResponse.json({ success: true }, { status: 200 });

  // 2. Process webhook data asynchronously (don't await)
  processWebhookData(request).catch((error) => {
    console.error('❌ Error processing Garmin webhook:', error);
  });

  const responseTime = Date.now() - startTime;
  if (DEBUG) {
    console.log(`⚡ Webhook acknowledged in ${responseTime}ms`);
  }

  return acknowledgeResponse;
}

/**
 * Process webhook data asynchronously.
 * Supports both PING (callbackURL to fetch) and PUSH (inline activity data).
 */
async function processWebhookData(request: Request) {
  try {
    const body = await request.json();
    const keys = Object.keys(body);
    const activities = body.activities;
    const hasActivitiesArray = Array.isArray(activities) && activities.length > 0;
    const firstActivity = hasActivitiesArray ? activities[0] : null;
    const isPing = firstActivity && 'callbackURL' in firstActivity && firstActivity.callbackURL;

    // Always log enough to see if we got activities and whether it's PING vs PUSH (for debugging empty DB)
    const topLevelUserId = body.userId ?? null;
    const firstActivityUserId = firstActivity && typeof firstActivity === 'object' && 'userId' in firstActivity ? (firstActivity as any).userId : null;
    console.log('📩 Garmin webhook payload', {
      keys,
      activitiesCount: hasActivitiesArray ? activities.length : 0,
      mode: isPing ? 'PING (callbackURL)' : hasActivitiesArray ? 'PUSH (inline)' : 'none',
      userId: topLevelUserId ?? firstActivityUserId ?? '(none)',
      hasBodyUserId: topLevelUserId != null,
      hasFirstActivityUserId: firstActivityUserId != null,
      timestamp: new Date().toISOString(),
    });

    if (DEBUG) {
      console.log('📩 Garmin webhook body:', JSON.stringify(body, null, 2));
    }

    // Garmin PING: activities contain callbackURL; we must fetch each URL to get the actual data
    if (hasActivitiesArray && isPing) {
      await handlePingActivities(activities, body.userId);
      return;
    }

    // Detect event type and route to appropriate handler (PUSH or other)
    const eventType = detectEventType(body);
    
    if (DEBUG) {
      console.log(`🔍 Detected event type: ${eventType}`);
    }

    switch (eventType) {
      case 'ACTIVITY_SUMMARY': {
        const result = await handleActivitySummary(
          body.activities || [],
          body.userId
        );
        console.log('📩 Garmin ACTIVITY_SUMMARY result', { ...result, userId: body.userId ?? '(none)' });
        break;
      }

      case 'ACTIVITY_DETAIL':
        await handleActivityDetail(
          body.activityDetails || [],
          body.userId
        );
        break;

      case 'ACTIVITY_FILE':
        await handleActivityFile(
          body.activityFiles || [],
          body.userId
        );
        break;

      case 'USER_PERMISSION_CHANGED':
        await handlePermissionChange({
          userId: body.userId,
          permissions: body.permissions,
          scopes: body.scopes,
          ...body
        });
        break;

      case 'USER_DEREGISTER':
        await handleDeregistration({
          userId: body.userId,
          reason: body.reason,
          ...body
        });
        break;

      case 'MOVEIQ':
        // MoveIQ events - handle if needed
        if (DEBUG) {
          console.log('📊 MoveIQ event received:', body);
        }
        // TODO: Implement MoveIQ handler if needed
        break;

      case 'MANUALLY_UPDATED':
        // Manually updated activities
        if (body.activities && Array.isArray(body.activities)) {
          await handleActivitySummary(body.activities, body.userId);
        }
        break;

      default:
        console.warn('❓ Unknown webhook event type:', eventType, {
          keys: Object.keys(body)
        });
    }

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    // Don't throw - we've already acknowledged the webhook
  }
}

/**
 * Detect event type from webhook payload
 */
function detectEventType(body: any): string {
  // Check for explicit eventType field
  if (body.eventType) {
    const eventType = body.eventType.toUpperCase();
    if (['ACTIVITY_SUMMARY', 'ACTIVITY_DETAIL', 'ACTIVITY_FILE', 
         'USER_PERMISSION_CHANGED', 'USER_DEREGISTER', 'MOVEIQ', 
         'MANUALLY_UPDATED'].includes(eventType)) {
      return eventType;
    }
  }

  // Infer from payload structure
  if (body.activities && Array.isArray(body.activities)) {
    return 'ACTIVITY_SUMMARY';
  }
  
  if (body.activityDetails && Array.isArray(body.activityDetails)) {
    return 'ACTIVITY_DETAIL';
  }
  
  if (body.activityFiles && Array.isArray(body.activityFiles)) {
    return 'ACTIVITY_FILE';
  }

  // Check for permission change indicators
  if (body.permissions || body.scopes) {
    return 'USER_PERMISSION_CHANGED';
  }

  // Check for deregistration indicators
  if (body.reason === 'USER_DEREGISTER' || body.action === 'deregister') {
    return 'USER_DEREGISTER';
  }

  // Default to unknown
  return 'UNKNOWN';
}

/**
 * Handle Garmin PING: fetch activity data from each callbackURL, then save.
 * Garmin sends { activities: [{ userId, callbackURL }] } and we must GET the URL to get the actual activity/activities.
 */
async function handlePingActivities(
  activities: Array<{ userId?: string; callbackURL?: string }>,
  userId?: string
): Promise<void> {
  const garminUserId = userId ?? activities[0]?.userId;
  if (!garminUserId) {
    console.warn('⚠️ Garmin PING: no userId in payload or activities');
    return;
  }

  const allFetched: any[] = [];
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
    } catch (err: any) {
      console.error('❌ Garmin PING fetch error:', err?.message, url?.slice(0, 80));
    }
  }

  if (allFetched.length === 0) {
    console.log('📩 Garmin PING: no activity data returned from callbackURLs');
    return;
  }

  const result = await handleActivitySummary(allFetched, garminUserId);
  console.log('📩 Garmin PING processed', { fetched: allFetched.length, ...result });
}
