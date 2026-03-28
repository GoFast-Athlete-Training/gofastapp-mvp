/**
 * Handle USER_DEREGISTER webhook events
 * Garmin-initiated: user revoked access in Garmin Connect — local wipe only (no outbound DELETE).
 */

import {
  clearGarminProductionAfterPlatformRevoke,
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

    await clearGarminProductionAfterPlatformRevoke(athlete.id);

    console.log(`✅ Garmin deregister handled for athlete ${athlete.id}${reason ? ` (reason: ${reason})` : ''}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error processing deregistration:', error);
    return { success: false, error: error.message };
  }
}
