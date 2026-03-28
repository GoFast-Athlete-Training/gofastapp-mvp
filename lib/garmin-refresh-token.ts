/**
 * Garmin Token Refresh
 * Uses refresh_token to obtain a new access_token (production OAuth only).
 * Prefer retry-on-401 at the HTTP layer over pre-emptive expiry math.
 */

import { prisma } from './prisma';

export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Refresh Garmin access token using refresh token
 */
export async function refreshGarminToken(
  athleteId: string
): Promise<RefreshTokenResult> {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        garmin_refresh_token: true,
        garmin_access_token: true,
        garmin_expires_in: true,
        garmin_connected_at: true
      }
    });

    if (!athlete?.garmin_refresh_token) {
      return {
        success: false,
        error: 'No refresh token found'
      };
    }

    const clientId = process.env.GARMIN_CLIENT_ID;
    const clientSecret = process.env.GARMIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Garmin OAuth credentials not configured'
      };
    }

    const tokenUrl = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: athlete.garmin_refresh_token
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Garmin token refresh failed:', response.status, errorText);
      return {
        success: false,
        error: `Token refresh failed: ${response.status} - ${errorText}`
      };
    }

    const tokenData = await response.json();

    await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        garmin_access_token: tokenData.access_token,
        garmin_refresh_token: tokenData.refresh_token || athlete.garmin_refresh_token,
        garmin_expires_in: tokenData.expires_in || 3600,
        garmin_connected_at: new Date()
      }
    });

    console.log(`✅ Tokens refreshed for athlete ${athleteId}`);

    return {
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || athlete.garmin_refresh_token,
      expiresIn: tokenData.expires_in || 3600
    };

  } catch (error: any) {
    console.error('❌ Token refresh error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
