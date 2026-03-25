/**
 * Handle USER_DEREGISTER webhook events
 * Disconnects Garmin when user deregisters
 */

import {
  disconnectGarmin,
  disconnectGarminTest,
  getAthleteByGarminUserId,
} from '../domain-garmin';

export interface Deregistration {
  userId?: string;
  reason?: string;
  [key: string]: any;
}

/**
 * Process deregistration webhook
 */
export async function handleDeregistration(
  data: Deregistration
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, reason } = data;

    if (userId === undefined || userId === null || userId === '') {
      return { success: false, error: 'No userId in deregistration event' };
    }

    const userIdStr = String(userId).trim();
    const athlete = await getAthleteByGarminUserId(userIdStr);
    if (!athlete) {
      console.warn(`⚠️ Athlete not found for Garmin userId: ${userIdStr}`);
      return { success: false, error: 'Athlete not found' };
    }

    const prodId = athlete.garmin_user_id?.trim() || null;
    const testId = athlete.garmin_test_user_id?.trim() || null;
    const matchesProd = !!prodId && prodId === userIdStr;
    const matchesTest = !!testId && testId === userIdStr;

    if (matchesProd) {
      await disconnectGarmin(athlete.id);
    }
    if (matchesTest) {
      await disconnectGarminTest(athlete.id);
    }

    if (!matchesProd && !matchesTest) {
      console.warn(
        `⚠️ USER_DEREGISTER userId ${userIdStr} did not match garmin_user_id or garmin_test_user_id for athlete ${athlete.id}; clearing both connections defensively`
      );
      await disconnectGarmin(athlete.id);
      await disconnectGarminTest(athlete.id);
    }

    console.log(`✅ Garmin deregister handled for athlete ${athlete.id}${reason ? ` (reason: ${reason})` : ''}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error processing deregistration:', error);
    return { success: false, error: error.message };
  }
}

