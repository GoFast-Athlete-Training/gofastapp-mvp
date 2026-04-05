/**
 * Garmin Training API — HTTP client for workout CRUD / schedule.
 * Base path must include `/training-api` (not root `/workout`).
 * Uses OAuth2 bearer tokens from connect flow (GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET for refresh only).
 * @see https://developer.garmin.com/gc-developer-program/training-api/
 */

import { GarminWorkout, GarminWorkoutSchedule } from "./types";
import { refreshGarminToken } from "@/lib/garmin-refresh-token";

const GARMIN_TRAINING_API_BASE = "https://apis.garmin.com/training-api";

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

export function createGarminTrainingApiForAthlete(
  athleteId: string,
  garminAccessToken: string
): GarminTrainingApi {
  return new GarminTrainingApi(garminAccessToken, athleteId);
}

/**
 * Training API client. Mutating calls (create/update/schedule/delete) retry once on 401 after refreshGarminToken.
 */
export class GarminTrainingApi {
  private bearerToken: string;
  private readonly baseUrl: string;
  private readonly athleteIdForRefresh: string | null;

  constructor(
    bearerToken: string,
    athleteIdForRefresh?: string | null,
    baseUrl: string = GARMIN_TRAINING_API_BASE
  ) {
    this.bearerToken = bearerToken;
    this.athleteIdForRefresh = athleteIdForRefresh ?? null;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.bearerToken}`,
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
    const raw = await response.text();

    if (!response.ok) {
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

    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined as T;
    }
    return JSON.parse(trimmed) as T;
  }

  /**
   * Retry once on 401 after refreshGarminToken (same pattern for mutating calls).
   */
  private async with401Retry<T>(fn: () => Promise<T>, isRetry = false): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (
        !isRetry &&
        e instanceof GarminApiError &&
        e.status === 401 &&
        this.athleteIdForRefresh
      ) {
        const refreshed = await refreshGarminToken(this.athleteIdForRefresh);
        if (refreshed.success && refreshed.accessToken) {
          this.bearerToken = refreshed.accessToken;
          return this.with401Retry(fn, true);
        }
      }
      throw e;
    }
  }

  async createWorkout(workout: GarminWorkout): Promise<{ workoutId: number }> {
    return this.with401Retry(() =>
      this.request<{ workoutId: number }>("POST", "/workout", workout)
    );
  }

  async getWorkout(workoutId: number): Promise<GarminWorkout> {
    return this.request<GarminWorkout>("GET", `/workout/${workoutId}`);
  }

  async updateWorkout(workoutId: number, workout: GarminWorkout): Promise<void> {
    return this.with401Retry(() =>
      this.request<void>("PUT", `/workout/${workoutId}`, workout)
    );
  }

  async deleteWorkout(workoutId: number): Promise<void> {
    return this.with401Retry(() =>
      this.request<void>("DELETE", `/workout/${workoutId}`)
    );
  }

  async scheduleWorkout(
    workoutId: number,
    date: string
  ): Promise<{ scheduleId: number }> {
    const schedule: GarminWorkoutSchedule = {
      workoutId,
      date,
    };
    return this.with401Retry(() =>
      this.request<{ scheduleId: number }>("POST", "/schedule", schedule)
    );
  }

  async getSchedule(scheduleId: number): Promise<GarminWorkoutSchedule> {
    return this.request<GarminWorkoutSchedule>("GET", `/schedule/${scheduleId}`);
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    return this.with401Retry(() =>
      this.request<void>("DELETE", `/schedule/${scheduleId}`)
    );
  }
}
