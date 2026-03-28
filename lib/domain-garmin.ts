import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const GARMIN_REGISTRATION_URL =
  'https://apis.garmin.com/wellness-api/rest/user/registration';

/** Thrown when prod Garmin access token is missing (derived “not connected”). */
export class GarminNotConnectedError extends Error {
  constructor(message = 'Garmin not connected') {
    super(message);
    this.name = 'GarminNotConnectedError';
  }
}

/**
 * Production Garmin bearer token only (no test-token path). Used for Training API + wellness pulls.
 */
export async function requireGarminToken(athleteId: string): Promise<string> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { garmin_access_token: true },
  });
  const t = athlete?.garmin_access_token?.trim();
  if (!t) {
    throw new GarminNotConnectedError();
  }
  return t;
}

/** Local wipe of all production Garmin columns (no outbound call). Use after Garmin-initiated deregister. */
export async function clearGarminProductionAfterPlatformRevoke(athleteId: string) {
  return wipeGarminProductionFields(athleteId);
}

async function wipeGarminProductionFields(athleteId: string) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      garmin_user_id: null,
      garmin_access_token: null,
      garmin_refresh_token: null,
      garmin_expires_in: null,
      garmin_scope: null,
      garmin_permissions: Prisma.JsonNull,
      garmin_user_profile: Prisma.JsonNull,
      garmin_user_sleep: Prisma.JsonNull,
      garmin_user_preferences: Prisma.JsonNull,
      garmin_is_connected: false,
      garmin_connected_at: null,
      garmin_last_sync_at: null,
      garmin_disconnected_at: new Date(),
    },
  });
}

export async function updateGarminConnection(
  athleteId: string,
  data: {
    garmin_user_id: string;
    garmin_access_token: string;
    garmin_refresh_token: string;
    garmin_expires_in: number;
    garmin_scope?: string;
  }
) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      ...data,
      garmin_is_connected: true,
      garmin_connected_at: new Date(),
    },
  });
}

/**
 * App-initiated disconnect: notify Garmin, then wipe all prod Garmin fields.
 * DELETE must run while the access token may still be valid.
 */
export async function disconnectGarmin(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { garmin_access_token: true },
  });
  if (athlete?.garmin_access_token) {
    try {
      await fetch(GARMIN_REGISTRATION_URL, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${athlete.garmin_access_token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // continue with local wipe — token may already be invalid
    }
  }
  return wipeGarminProductionFields(athleteId);
}

/** Resolve athlete by Garmin Connect user id (wellness webhooks). */
export async function getAthleteByGarminUserId(garminUserId: string) {
  return prisma.athlete.findUnique({
    where: { garmin_user_id: garminUserId },
  });
}

/**
 * Fetch and save Garmin user info after OAuth token exchange
 */
export async function fetchAndSaveGarminUserInfo(
  athleteId: string,
  accessToken: string
) {
  try {
    // Fetch user info from Garmin API
    const userInfoUrl = 'https://apis.garmin.com/wellness-api/rest/user/id';
    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Garmin user info fetch failed:', response.status, errorText);
      return { success: false, error: `Failed to fetch user info: ${response.status}` };
    }

    const userData = await response.json();
    const garminUserId = userData.userId || userData.id || null;

    if (garminUserId) {
      // Update athlete with Garmin user ID and profile
      await prisma.athlete.update({
        where: { id: athleteId },
        data: {
          garmin_user_id: garminUserId,
          garmin_user_profile: userData,
          garmin_last_sync_at: new Date()
        }
      });
      console.log(`✅ Garmin user ID saved: ${garminUserId}`);
      return { success: true, garminUserId, userData };
    } else {
      console.warn('⚠️ No userId found in Garmin user data response');
      return { success: false, error: 'No userId in response' };
    }
  } catch (error: any) {
    console.error('❌ Error fetching Garmin user info:', error);
    return { success: false, error: error.message };
  }
}

