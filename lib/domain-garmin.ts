import { prisma } from './prisma';

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

export async function disconnectGarmin(athleteId: string) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      garmin_is_connected: false,
      garmin_disconnected_at: new Date(),
      garmin_access_token: null,
      garmin_refresh_token: null,
    },
  });
}

export async function getGarminConnection(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_is_connected: true,
      garmin_user_id: true,
      garmin_connected_at: true,
    },
  });

  return athlete;
}

/**
 * Persist Garmin **test** OAuth tokens only. Never writes garmin_user_id, garmin_access_token,
 * garmin_refresh_token, garmin_is_connected, or garmin_user_profile (prod fields).
 */
export async function updateGarminTestConnection(
  athleteId: string,
  data: {
    garmin_test_access_token: string;
    garmin_test_user_id: string;
    garmin_use_test_tokens?: boolean;
    garmin_test_linked_email?: string | null;
  }
) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      garmin_test_access_token: data.garmin_test_access_token,
      garmin_test_user_id: data.garmin_test_user_id,
      garmin_use_test_tokens: data.garmin_use_test_tokens ?? true,
      ...(data.garmin_test_linked_email !== undefined && {
        garmin_test_linked_email: data.garmin_test_linked_email,
      }),
    },
  });
}

/**
 * Resolve Garmin userId from token for **test** flow only (no DB writes).
 */
export async function fetchGarminTestUserId(accessToken: string): Promise<{
  success: boolean;
  garminUserId?: string;
  error?: string;
}> {
  try {
    const userInfoUrl = "https://apis.garmin.com/wellness-api/rest/user/id";
    const response = await fetch(userInfoUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Garmin test user id fetch failed:", response.status, errorText);
      return { success: false, error: `Failed to fetch user info: ${response.status}` };
    }

    const userData = await response.json();
    const garminUserId = userData.userId || userData.id || null;

    if (!garminUserId) {
      return { success: false, error: "No userId in Garmin response" };
    }

    return { success: true, garminUserId: String(garminUserId) };
  } catch (error: any) {
    console.error("❌ fetchGarminTestUserId error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve athlete by production Garmin user id, or by test sandbox user id (webhooks in test mode).
 */
export async function getAthleteByGarminUserId(garminUserId: string) {
  const prod = await prisma.athlete.findUnique({
    where: { garmin_user_id: garminUserId },
  });
  if (prod) return prod;
  return prisma.athlete.findFirst({
    where: { garmin_test_user_id: garminUserId },
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

