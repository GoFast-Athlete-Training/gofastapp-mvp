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
  authMode: "bearer" | "oauth1";
}

interface GarminClientOptions {
  preferTest?: boolean;
}

function getGarminTrainingAuthMode(): "bearer" | "oauth1" {
  const mode = (process.env.GARMIN_TRAINING_AUTH_MODE || "bearer").toLowerCase();
  return mode === "oauth1" ? "oauth1" : "bearer";
}

function getMissingOauthEnvFields() {
  const fields = [
    {
      key: "GARMIN_TRAINING_OAUTH_CONSUMER_KEY",
      value: process.env.GARMIN_TRAINING_OAUTH_CONSUMER_KEY?.trim(),
    },
    {
      key: "GARMIN_TRAINING_OAUTH_CONSUMER_SECRET",
      value: process.env.GARMIN_TRAINING_OAUTH_CONSUMER_SECRET?.trim(),
    },
    {
      key: "GARMIN_TRAINING_OAUTH_TOKEN_SECRET",
      value: process.env.GARMIN_TRAINING_OAUTH_TOKEN_SECRET?.trim(),
    },
  ];
  return fields.filter((f) => !f.value).map((f) => f.key);
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
      garmin_test_user_id: true,
      garmin_use_test_tokens: true,
      garmin_test_access_token: true,
      garmin_access_token: true,
      garmin_refresh_token: true,
      garmin_expires_in: true,
      garmin_connected_at: true,
      garmin_is_connected: true,
    },
  });

  if (!athlete) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  const prodGarminId = athlete.garmin_user_id?.trim() || null;
  const testGarminId = athlete.garmin_test_user_id?.trim() || null;
  const hasTestTokenFlow =
    athlete.garmin_use_test_tokens && !!(athlete.garmin_test_access_token?.trim());

  if (!prodGarminId && !hasTestTokenFlow) {
    throw new GarminConnectionError("Athlete is not connected to Garmin");
  }

  const preferTest = options.preferTest ?? true;
  const authMode = getGarminTrainingAuthMode();

  if (authMode === "oauth1") {
    if (preferTest && athlete.garmin_use_test_tokens) {
      throw new GarminConnectionError(
        "Test tokens are not supported for Garmin Training OAuth1 mode",
        400,
        "Disable garmin_use_test_tokens for training push or switch GARMIN_TRAINING_AUTH_MODE=bearer"
      );
    }
    const missingOauthFields = getMissingOauthEnvFields();
    if (missingOauthFields.length > 0) {
      throw new GarminConnectionError(
        "Garmin OAuth1 credentials are incomplete",
        500,
        `Missing env vars: ${missingOauthFields.join(", ")}`
      );
    }
  }

  if (preferTest && athlete.garmin_use_test_tokens && athlete.garmin_test_access_token) {
    const testToken = athlete.garmin_test_access_token.trim();
    if (!testToken) {
      throw new GarminConnectionError("Athlete is not connected to Garmin");
    }
    // Prefer test sandbox user id when present so logs / identity match the test account, not prod.
    const identityForTest = testGarminId || prodGarminId;
    if (!identityForTest) {
      throw new GarminConnectionError(
        "Garmin test mode needs a Garmin user id — complete Connect Garmin (Test) OAuth first",
        400
      );
    }
    return {
      client: new GarminWorkoutApiClient({
        mode: "bearer",
        bearerToken: testToken,
      }),
      garminUserId: identityForTest,
      tokenMode: "test",
      authMode: "bearer",
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

  if (!prodGarminId) {
    throw new GarminConnectionError(
      "Production Garmin tokens present but garmin_user_id is missing — reconnect production Garmin"
    );
  }

  if (authMode === "oauth1") {
    return {
      client: new GarminWorkoutApiClient({
        mode: "oauth1",
        oauth1: {
          consumerKey: process.env.GARMIN_TRAINING_OAUTH_CONSUMER_KEY!.trim(),
          consumerSecret: process.env.GARMIN_TRAINING_OAUTH_CONSUMER_SECRET!.trim(),
          token: productionToken,
          tokenSecret: process.env.GARMIN_TRAINING_OAUTH_TOKEN_SECRET!.trim(),
        },
      }),
      garminUserId: prodGarminId,
      tokenMode: "production",
      authMode: "oauth1",
    };
  }

  return {
    client: new GarminWorkoutApiClient({
      mode: "bearer",
      bearerToken: productionToken,
    }),
    garminUserId: prodGarminId,
    tokenMode: "production",
    authMode: "bearer",
  };
}
