import { prisma } from "@/lib/prisma";
import { isTokenExpired, refreshGarminToken } from "@/lib/garmin-refresh-token";
import { GarminWorkoutApiClient } from "@/lib/garmin-workouts/api-client";

export class GarminConnectionError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status = 400, details?: string) {
    super(message);
    this.name = "GarminConnectionError";
    this.status = status;
    this.details = details;
  }
}

export interface GarminClientContext {
  client: GarminWorkoutApiClient;
  garminUserId: string;
  tokenMode: "test" | "production";
}

interface GarminClientOptions {
  preferTest?: boolean;
}

/**
 * Resolve a Garmin API client for an athlete and enforce basic connection guardrails.
 */
export async function getGarminClient(athleteId: string): Promise<GarminClientContext> {
  return getGarminClientForMode(athleteId, { preferTest: true });
}

export async function getGarminClientForMode(
  athleteId: string,
  options: GarminClientOptions
): Promise<GarminClientContext> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_user_id: true,
      garmin_use_test_tokens: true,
      garmin_test_access_token: true,
      garmin_access_token: true,
      garmin_refresh_token: true,
      garmin_expires_in: true,
      garmin_connected_at: true,
      garmin_is_connected: true,
    },
  });

  if (!athlete?.garmin_user_id) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  const preferTest = options.preferTest ?? true;

  if (preferTest && athlete.garmin_use_test_tokens && athlete.garmin_test_access_token) {
    const testToken = athlete.garmin_test_access_token.trim();
    if (!testToken) {
      throw new GarminConnectionError("Athlete is not connected to Garmin");
    }
    return {
      client: new GarminWorkoutApiClient(testToken),
      garminUserId: athlete.garmin_user_id,
      tokenMode: "test",
    };
  }

  let productionToken = athlete.garmin_access_token?.trim() || null;
  if (
    productionToken &&
    isTokenExpired(athlete.garmin_expires_in ?? null, athlete.garmin_connected_at ?? null)
  ) {
    const refreshed = await refreshGarminToken(athleteId);
    if (!refreshed.success || !refreshed.accessToken) {
      productionToken = null;
    } else {
      productionToken = refreshed.accessToken.trim();
    }
  }

  if (!productionToken) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  return {
    client: new GarminWorkoutApiClient(productionToken),
    garminUserId: athlete.garmin_user_id,
    tokenMode: "production",
  };
}
