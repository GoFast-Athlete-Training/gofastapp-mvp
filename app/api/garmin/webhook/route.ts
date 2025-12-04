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
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  
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
 * Process webhook data asynchronously
 */
async function processWebhookData(request: Request) {
  try {
    const body = await request.json();
    
    if (DEBUG) {
      console.log('📩 Garmin webhook received:', {
        keys: Object.keys(body),
        timestamp: new Date().toISOString(),
        body: JSON.stringify(body, null, 2)
      });
    } else {
      console.log('📩 Garmin webhook received:', {
        keys: Object.keys(body),
        timestamp: new Date().toISOString()
      });
    }

    // Detect event type and route to appropriate handler
    const eventType = detectEventType(body);
    
    if (DEBUG) {
      console.log(`🔍 Detected event type: ${eventType}`);
    }

    switch (eventType) {
      case 'ACTIVITY_SUMMARY':
        await handleActivitySummary(
          body.activities || [],
          body.userId
        );
        break;

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
