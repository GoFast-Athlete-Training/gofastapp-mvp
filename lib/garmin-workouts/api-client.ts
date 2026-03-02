/**
 * Garmin Workout API Client
 * Handles API calls to Garmin Connect Training API
 */

import { GarminWorkout, GarminWorkoutSchedule, GarminWorkoutResponse } from "./types";

const GARMIN_API_BASE = "https://apis.garmin.com"; // Confirm exact base URL

export class GarminWorkoutApiClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl: string = GARMIN_API_BASE) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Authorization": `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Garmin API error: ${error.message || response.statusText}`);
    }

    return response.json();
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
