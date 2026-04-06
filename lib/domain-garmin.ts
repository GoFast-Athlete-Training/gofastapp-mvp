import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { decodeGarminAccessTokenClaims } from './garmin-access-token-claims';
import { refreshGarminToken } from './garmin-refresh-token';

/** Refresh access token this many seconds before JWT / metadata expiry to avoid 401 + retry noise. */
const GARMIN_TOKEN_FRESH_SKEW_SEC = 300;

const GARMIN_REGISTRATION_URL =
  'https://apis.garmin.com/wellness-api/rest/user/registration';

/**
 * Register the user's Garmin account for wellness push (pair to DELETE on disconnect).
 * Does not throw; log and return status for observability.
 */
export async function registerGarminUser(
  accessToken: string
): Promise<{ status: number; ok: boolean }> {
  try {
    const res = await fetch(GARMIN_REGISTRATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.text().catch(() => '');
    console.log(
      `[GARMIN REGISTER] POST registration status=${res.status} body=${body.slice(0, 200)}`
    );
    return { status: res.status, ok: res.ok || res.status === 409 };
  } catch (err: unknown) {
    console.error('[GARMIN REGISTER] POST registration failed:', err);
    return { status: 0, ok: false };
  }
}

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

/**
 * Same as {@link requireGarminToken}, but refreshes first when the stored access token is
 * expired or within {@link GARMIN_TOKEN_FRESH_SKEW_SEC} of expiry (JWT `exp`, else
 * `garmin_connected_at` + `garmin_expires_in`). Use before Training API calls to reduce
 * "Token is not active" 401s that succeed only after retry.
 */
export async function requireGarminTokenFresh(athleteId: string): Promise<string> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_access_token: true,
      garmin_refresh_token: true,
      garmin_expires_in: true,
      garmin_connected_at: true,
    },
  });
  const t = athlete?.garmin_access_token?.trim();
  if (!t) {
    throw new GarminNotConnectedError();
  }
  if (!athlete?.garmin_refresh_token?.trim()) {
    return t;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const claims = decodeGarminAccessTokenClaims(t);
  let needsRefresh = false;

  if (typeof claims?.exp === 'number' && Number.isFinite(claims.exp)) {
    needsRefresh = claims.exp <= nowSec + GARMIN_TOKEN_FRESH_SKEW_SEC;
  } else if (
    athlete.garmin_connected_at != null &&
    athlete.garmin_expires_in != null &&
    Number.isFinite(athlete.garmin_expires_in) &&
    athlete.garmin_expires_in > 0
  ) {
    const issuedMs = athlete.garmin_connected_at.getTime();
    const expiresMs = issuedMs + athlete.garmin_expires_in * 1000;
    needsRefresh = Date.now() >= expiresMs - GARMIN_TOKEN_FRESH_SKEW_SEC * 1000;
  }

  if (!needsRefresh) {
    return t;
  }

  const refreshed = await refreshGarminToken(athleteId);
  if (refreshed.success && refreshed.accessToken?.trim()) {
    console.log(
      `[GARMIN] Proactive token refresh for athlete ${athleteId} (avoid expired Training API bearer)`
    );
    return refreshed.accessToken.trim();
  }

  console.warn(
    `[GARMIN] Proactive refresh skipped or failed for ${athleteId}; using stored token (${refreshed.error ?? 'unknown'})`
  );
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
    garmin_user_id?: string | null;
    garmin_access_token: string;
    garmin_refresh_token: string;
    garmin_expires_in: number;
    garmin_scope?: string;
    garmin_permissions?: Record<string, unknown>;
  }
) {
  const payload: Prisma.AthleteUpdateInput = {
    garmin_access_token: data.garmin_access_token,
    garmin_refresh_token: data.garmin_refresh_token,
    garmin_expires_in: data.garmin_expires_in,
    garmin_is_connected: true,
    garmin_connected_at: new Date(),
  };
  if (data.garmin_scope !== undefined) {
    payload.garmin_scope = data.garmin_scope;
  }
  if (data.garmin_user_id !== undefined) {
    payload.garmin_user_id = data.garmin_user_id;
  }
  if (data.garmin_permissions !== undefined) {
    payload.garmin_permissions = data.garmin_permissions as Prisma.InputJsonValue;
  }
  return prisma.athlete.update({
    where: { id: athleteId },
    data: payload,
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

