/**
 * Handle USER_PERMISSION_CHANGED webhook events
 * Updates athlete permissions when Garmin permissions change
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';

export interface PermissionChange {
  userId?: string;
  permissions?: any;
  scopes?: string[];
  [key: string]: any;
}

/**
 * Process permission change webhook
 */
export async function handlePermissionChange(
  data: PermissionChange
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, permissions, scopes } = data;

    if (!userId) {
      return { success: false, error: 'No userId in permission change event' };
    }

    const athlete = await getAthleteByGarminUserId(userId);
    if (!athlete) {
      console.warn(`⚠️ Athlete not found for Garmin userId: ${userId}`);
      return { success: false, error: 'Athlete not found' };
    }

    // Update permissions in database
    await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        garmin_permissions: {
          permissions: permissions || {},
          scopes: scopes || [],
          updatedAt: new Date().toISOString()
        },
        garmin_scope: scopes?.join(' ') || athlete.garmin_scope
      }
    });

    console.log(`✅ Permissions updated for athlete ${athlete.id}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error processing permission change:', error);
    return { success: false, error: error.message };
  }
}

