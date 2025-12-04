/**
 * Garmin Token Refresh Logic
 * Handles refreshing expired access tokens using refresh tokens
 */

import { prisma } from './prisma';
import { getAthleteByGarminUserId } from './domain-garmin';

export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Check if access token is expired or about to expire
 */
export function isTokenExpired(expiresIn: number | null, connectedAt: Date | null): boolean {
  if (!expiresIn || !connectedAt) {
    return true; // Assume expired if we don't have the data
  }

  // Check if token expires in less than 5 minutes (300 seconds)
  const expirationTime = connectedAt.getTime() + (expiresIn * 1000);
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes buffer

  return (expirationTime - now) < buffer;
}

/**
 * Refresh Garmin access token using refresh token
 */
export async function refreshGarminToken(
  athleteId: string
): Promise<RefreshTokenResult> {
  try {
    // Get athlete with tokens
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

    // Call Garmin token refresh endpoint
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

    // Save updated tokens to database
    await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        garmin_access_token: tokenData.access_token,
        garmin_refresh_token: tokenData.refresh_token || athlete.garmin_refresh_token,
        garmin_expires_in: tokenData.expires_in || 3600,
        garmin_connected_at: new Date() // Reset connection time
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

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(athleteId: string): Promise<string | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_access_token: true,
      garmin_expires_in: true,
      garmin_connected_at: true,
      garmin_refresh_token: true
    }
  });

  if (!athlete?.garmin_access_token) {
    return null;
  }

  // Check if token needs refresh
  if (isTokenExpired(athlete.garmin_expires_in, athlete.garmin_connected_at)) {
    console.log(`🔄 Access token expired, refreshing for athlete ${athleteId}`);
    const refreshResult = await refreshGarminToken(athleteId);
    
    if (!refreshResult.success) {
      console.error(`❌ Failed to refresh token: ${refreshResult.error}`);
      return null;
    }

    return refreshResult.accessToken || null;
  }

  return athlete.garmin_access_token;
}

