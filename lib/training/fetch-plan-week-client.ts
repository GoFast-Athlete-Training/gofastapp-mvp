/**
 * Browser fetch helpers for plan detail + week workouts.
 * Shared by My Training hub and training-setup calendar.
 */

export type TrainingPlanWeekWorkout = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  phase?: string | null;
  estimatedDistanceInMeters: number | null;
  matchedActivityId: string | null;
  actualDistanceMeters: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualAverageHeartRate: number | null;
  actualDurationSeconds: number | null;
};

export async function fetchTrainingPlanDetail(
  planId: string,
  bearerToken: string
): Promise<{ plan: unknown; athleteFiveKPace: string | null }> {
  const res = await fetch(`/api/training-plan/${planId}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  const data = (await res.json()) as {
    error?: string;
    plan?: unknown;
    athleteFiveKPace?: string | null;
  };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to load plan");
  }
  return { plan: data.plan, athleteFiveKPace: data.athleteFiveKPace ?? null };
}

export async function fetchTrainingWeekWorkouts(
  planId: string,
  weekNumber: number,
  bearerToken: string
): Promise<{ workouts: TrainingPlanWeekWorkout[] }> {
  const res = await fetch(
    `/api/training/week?planId=${encodeURIComponent(planId)}&weekNumber=${weekNumber}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  const data = (await res.json()) as { error?: string; workouts?: TrainingPlanWeekWorkout[] };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to load week");
  }
  return { workouts: Array.isArray(data.workouts) ? data.workouts : [] };
}
