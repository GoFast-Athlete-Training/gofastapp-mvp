/**
 * Handle USER_PERMISSION_CHANGED webhook events
 * Fetches current permissions from Garmin and stores them (aligned with legacy backend).
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';

export interface PermissionChange {
  userId?: string;
  permissions?: any;
  scopes?: string[];
  [key: string]: any;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process permission change webhook
 */
export async function handlePermissionChange(
  data: PermissionChange
): Promise<{ success: boolean; error?: string }> {
  try {
    let { userId } = data;

    const nested = (data as { userPermissionsChange?: Array<{ userId?: string }> })
      ?.userPermissionsChange?.[0];
    if (!userId && nested?.userId) {
      userId = nested.userId;
    }

    if (!userId) {
      return { success: false, error: 'No userId in permission change event' };
    }

    let athlete = await getAthleteByGarminUserId(userId);
    if (!athlete) {
      await sleep(1000);
      athlete = await getAthleteByGarminUserId(userId);
    }
    if (!athlete) {
      console.warn(`⚠️ Athlete not found for Garmin userId: ${userId}`);
      return { success: false, error: 'Athlete not found' };
    }

    const token = athlete.garmin_access_token?.trim();
    if (!token) {
      console.warn(`⚠️ No access token for athlete ${athlete.id}; cannot fetch permissions`);
      return { success: false, error: 'No Garmin access token' };
    }

    const resp = await fetch(
      'https://apis.garmin.com/wellness-api/rest/user/permissions',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const currentPerms = resp.ok ? await resp.json() : [];
    const scopesFromWebhook = data.scopes;

    await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        garmin_permissions: {
          current: currentPerms,
          webhook: { permissions: data.permissions || {}, scopes: scopesFromWebhook || [] },
          updatedAt: new Date().toISOString(),
        },
        garmin_scope:
          Array.isArray(scopesFromWebhook) && scopesFromWebhook.length > 0
            ? scopesFromWebhook.join(' ')
            : athlete.garmin_scope,
        garmin_last_sync_at: new Date(),
      },
    });

    console.log(`✅ Permissions updated for athlete ${athlete.id}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error processing permission change:', error);
    return { success: false, error: error.message };
  }
}
