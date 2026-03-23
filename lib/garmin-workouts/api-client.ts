/**
 * Garmin Workout API Client
 * Handles API calls to Garmin Connect Training API
 *
 * Base path must include `/training-api` (not root `/workout`).
 * @see https://developer.garmin.com/gc-developer-program/training-api/
 */

import { GarminWorkout, GarminWorkoutSchedule } from "./types";

/** Full base including `/training-api` — override with GARMIN_TRAINING_API_BASE if Garmin changes host/path */
function defaultTrainingApiBase(): string {
  return (
    process.env.GARMIN_TRAINING_API_BASE?.replace(/\/$/, "") ||
    "https://apis.garmin.com/training-api"
  );
}

export class GarminWorkoutApiClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl?: string) {
    this.accessToken = accessToken;
    this.baseUrl = (baseUrl ?? defaultTrainingApiBase()).replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.accessToken}`,
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
      let message = response.statusText;
      try {
        const parsed = JSON.parse(raw) as { message?: string; error?: string; errors?: unknown };
        message =
          parsed.message ||
          parsed.error ||
          (typeof parsed.errors === "string" ? parsed.errors : JSON.stringify(parsed.errors)) ||
          raw.slice(0, 500);
      } catch {
        if (raw) message = raw.slice(0, 500);
      }
      throw new Error(
        `Garmin Training API ${response.status} ${url}: ${message || "Unknown error"}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a workout
   * POST /workout
   */
  async createWorkout(workout: GarminWorkout): Promise<{ workoutId: number }> {
    return this.request<{ workoutId: number }>("POST", "/workout", workout);
  }

  /**
   * Get workout details
   * GET /workout/{workoutId}
   */
  async getWorkout(workoutId: number): Promise<GarminWorkout> {
    return this.request<GarminWorkout>("GET", `/workout/${workoutId}`);
  }

  /**
   * Update a workout
   * PUT /workout/{workoutId}
   */
  async updateWorkout(workoutId: number, workout: GarminWorkout): Promise<void> {
    return this.request<void>("PUT", `/workout/${workoutId}`, workout);
  }

  /**
   * Delete a workout
   * DELETE /workout/{workoutId}
   */
  async deleteWorkout(workoutId: number): Promise<void> {
    return this.request<void>("DELETE", `/workout/${workoutId}`);
  }

  /**
   * Schedule a workout for a specific date
   * POST /schedule
   */
  async scheduleWorkout(
    workoutId: number,
    date: string // YYYY-MM-DD
  ): Promise<{ scheduleId: number }> {
    const schedule: GarminWorkoutSchedule = {
      workoutId,
      date,
    };
    return this.request<{ scheduleId: number }>("POST", "/schedule", schedule);
  }

  /**
   * Get schedule details
   * GET /schedule/{scheduleId}
   */
  async getSchedule(scheduleId: number): Promise<GarminWorkoutSchedule> {
    return this.request<GarminWorkoutSchedule>("GET", `/schedule/${scheduleId}`);
  }

  /**
   * Delete a schedule
   * DELETE /schedule/{scheduleId}
   */
  async deleteSchedule(scheduleId: number): Promise<void> {
    return this.request<void>("DELETE", `/schedule/${scheduleId}`);
  }
}
