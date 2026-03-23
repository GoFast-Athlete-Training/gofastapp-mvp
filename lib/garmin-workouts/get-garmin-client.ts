import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/garmin-refresh-token";
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

/**
 * Resolve a Garmin API client for an athlete and enforce basic connection guardrails.
 */
export async function getGarminClient(athleteId: string): Promise<GarminClientContext> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_user_id: true,
      garmin_use_test_tokens: true,
      garmin_test_access_token: true,
      garmin_access_token: true,
      garmin_is_connected: true,
    },
  });

  if (!athlete?.garmin_user_id) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  const accessToken = await getValidAccessToken(athleteId);
  if (!accessToken) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  const tokenMode =
    athlete.garmin_use_test_tokens && !!athlete.garmin_test_access_token ? "test" : "production";

  return {
    client: new GarminWorkoutApiClient(accessToken),
    garminUserId: athlete.garmin_user_id,
    tokenMode,
  };
}
