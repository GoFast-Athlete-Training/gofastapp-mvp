/**
 * Garmin Training API — HTTP client for workout CRUD / schedule.
 * Base path must include `/training-api` (not root `/workout`).
 * @see https://developer.garmin.com/gc-developer-program/training-api/
 */

import { GarminWorkout, GarminWorkoutSchedule } from "./types";
import { GarminOAuth1Config, generateGarminOAuthHeader } from "@/lib/integrations/garmin/auth";
import { refreshGarminToken } from "@/lib/garmin-refresh-token";

export class GarminApiError extends Error {
  status: number;
  url: string;
  details: string;
  rawBody?: string;

  constructor(params: {
    status: number;
    url: string;
    details: string;
    rawBody?: string;
  }) {
    super(`Garmin Training API ${params.status} ${params.url}: ${params.details}`);
    this.name = "GarminApiError";
    this.status = params.status;
    this.url = params.url;
    this.details = params.details;
    this.rawBody = params.rawBody;
  }
}

export type GarminAuthMode = "bearer" | "oauth1";

export interface GarminClientAuthConfig {
  mode: GarminAuthMode;
  bearerToken?: string;
  oauth1?: GarminOAuth1Config;
}

function defaultTrainingApiBase(): string {
  return (
    process.env.GARMIN_TRAINING_API_BASE?.replace(/\/$/, "") ||
    "https://apis.garmin.com/training-api"
  );
}

function normalizeAuth(
  authConfig: GarminClientAuthConfig | string
): GarminClientAuthConfig {
  if (typeof authConfig === "string") {
    return { mode: "bearer", bearerToken: authConfig };
  }
  return authConfig;
}

function trainingAuthModeFromEnv(): "bearer" | "oauth1" {
  const m = (process.env.GARMIN_TRAINING_AUTH_MODE || "bearer").toLowerCase().trim();
  if (m === "oauth1" || m === "oauth_1") return "oauth1";
  return "bearer";
}

/**
 * Build a Training API client for workout push using env `GARMIN_TRAINING_AUTH_MODE`.
 * - bearer (default): OAuth2 access token in Authorization header; 401 → refresh + retry.
 * - oauth1: HMAC-SHA1 header; uses `garmin_access_token` as oauth_token and global token secret env.
 */
export function createGarminTrainingApiForAthlete(
  athleteId: string,
  garminAccessToken: string
): GarminTrainingApi {
  const mode = trainingAuthModeFromEnv();
  if (mode === "oauth1") {
    const consumerKey = process.env.GARMIN_TRAINING_OAUTH_CONSUMER_KEY?.trim();
    const consumerSecret = process.env.GARMIN_TRAINING_OAUTH_CONSUMER_SECRET?.trim();
    const tokenSecret = process.env.GARMIN_TRAINING_OAUTH_TOKEN_SECRET?.trim();
    if (!consumerKey || !consumerSecret || !tokenSecret) {
      throw new Error(
        "GARMIN_TRAINING_AUTH_MODE=oauth1 requires GARMIN_TRAINING_OAUTH_CONSUMER_KEY, GARMIN_TRAINING_OAUTH_CONSUMER_SECRET, and GARMIN_TRAINING_OAUTH_TOKEN_SECRET"
      );
    }
    return new GarminTrainingApi(
      {
        mode: "oauth1",
        oauth1: {
          consumerKey,
          consumerSecret,
          token: garminAccessToken,
          tokenSecret,
        },
      },
      athleteId
    );
  }
  return new GarminTrainingApi(garminAccessToken, athleteId);
}

/**
 * Training API client. For bearer auth with athleteId, createWorkout retries once on 401 after refreshGarminToken.
 */
export class GarminTrainingApi {
  private authConfig: GarminClientAuthConfig;
  private baseUrl: string;
  private athleteIdForRefresh: string | null;

  constructor(
    authConfig: GarminClientAuthConfig | string,
    athleteIdForRefresh?: string | null,
    baseUrl?: string
  ) {
    this.authConfig = normalizeAuth(authConfig);
    this.athleteIdForRefresh = athleteIdForRefresh ?? null;
    this.baseUrl = (baseUrl ?? defaultTrainingApiBase()).replace(/\/$/, "");
  }

  private getAuthorizationHeader(method: string, url: string, body?: unknown): string {
    if (this.authConfig.mode === "oauth1") {
      if (
        !this.authConfig.oauth1?.consumerKey ||
        !this.authConfig.oauth1.consumerSecret ||
        !this.authConfig.oauth1.token ||
        !this.authConfig.oauth1.tokenSecret
      ) {
        throw new Error("Missing Garmin OAuth1 credentials");
      }
      return generateGarminOAuthHeader({
        method,
        url,
        consumerKey: this.authConfig.oauth1.consumerKey,
        consumerSecret: this.authConfig.oauth1.consumerSecret,
        token: this.authConfig.oauth1.token,
        tokenSecret: this.authConfig.oauth1.tokenSecret,
        body,
      });
    }

    if (!this.authConfig.bearerToken) {
      throw new Error("Missing Garmin bearer token");
    }
    return `Bearer ${this.authConfig.bearerToken}`;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      Authorization: this.getAuthorizationHeader(method, url, body),
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && body !== null) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const raw = await response.text();
      let details = response.statusText;
      try {
        const parsed = JSON.parse(raw) as {
          message?: string;
          error?: string;
          errors?: unknown;
        };
        details =
          parsed.message ||
          parsed.error ||
          (typeof parsed.errors === "string"
            ? parsed.errors
            : JSON.stringify(parsed.errors)) ||
          raw.slice(0, 500);
      } catch {
        if (raw) details = raw.slice(0, 500);
      }

      const logPayload = {
        method,
        status: response.status,
        url,
        details: details || "Unknown error",
        rawBody: raw ?? "",
      };
      console.error("[GARMIN_TRAINING_API]", JSON.stringify(logPayload));

      throw new GarminApiError({
        status: response.status,
        url,
        details: details || "Unknown error",
        rawBody: raw || undefined,
      });
    }

    return response.json() as Promise<T>;
  }

  async createWorkout(workout: GarminWorkout): Promise<{ workoutId: number }> {
    return this.createWorkoutWithRetry(workout, false);
  }

  private async createWorkoutWithRetry(
    workout: GarminWorkout,
    isRetry: boolean
  ): Promise<{ workoutId: number }> {
    try {
      return await this.request<{ workoutId: number }>("POST", "/workout", workout);
    } catch (e) {
      if (
        !isRetry &&
        e instanceof GarminApiError &&
        e.status === 401 &&
        this.athleteIdForRefresh &&
        this.authConfig.mode === "bearer"
      ) {
        const refreshed = await refreshGarminToken(this.athleteIdForRefresh);
        if (refreshed.success && refreshed.accessToken) {
          this.authConfig = {
            ...this.authConfig,
            bearerToken: refreshed.accessToken,
          };
          return this.createWorkoutWithRetry(workout, true);
        }
      }
      throw e;
    }
  }

  async getWorkout(workoutId: number): Promise<GarminWorkout> {
    return this.request<GarminWorkout>("GET", `/workout/${workoutId}`);
  }

  async updateWorkout(workoutId: number, workout: GarminWorkout): Promise<void> {
    return this.request<void>("PUT", `/workout/${workoutId}`, workout);
  }

  async deleteWorkout(workoutId: number): Promise<void> {
    return this.request<void>("DELETE", `/workout/${workoutId}`);
  }

  async scheduleWorkout(
    workoutId: number,
    date: string
  ): Promise<{ scheduleId: number }> {
    const schedule: GarminWorkoutSchedule = {
      workoutId,
      date,
    };
    return this.request<{ scheduleId: number }>("POST", "/schedule", schedule);
  }

  async getSchedule(scheduleId: number): Promise<GarminWorkoutSchedule> {
    return this.request<GarminWorkoutSchedule>("GET", `/schedule/${scheduleId}`);
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    return this.request<void>("DELETE", `/schedule/${scheduleId}`);
  }
}
