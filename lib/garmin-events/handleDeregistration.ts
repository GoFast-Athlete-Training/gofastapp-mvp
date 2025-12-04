/**
 * Handle USER_DEREGISTER webhook events
 * Disconnects Garmin when user deregisters
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import { disconnectGarmin } from '../domain-garmin';

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

    if (!userId) {
      return { success: false, error: 'No userId in deregistration event' };
    }

    const athlete = await getAthleteByGarminUserId(userId);
    if (!athlete) {
      console.warn(`⚠️ Athlete not found for Garmin userId: ${userId}`);
      return { success: false, error: 'Athlete not found' };
    }

    // Disconnect Garmin integration
    await disconnectGarmin(athlete.id);

    console.log(`✅ Garmin disconnected for athlete ${athlete.id}${reason ? ` (reason: ${reason})` : ''}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error processing deregistration:', error);
    return { success: false, error: error.message };
  }
}

