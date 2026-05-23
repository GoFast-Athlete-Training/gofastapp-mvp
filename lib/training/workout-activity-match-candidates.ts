import {
  activityLocalYmdFromSummary,
  activityNameContainsPushedWorkoutTitle,
  utcDayRangeFromYmd,
} from "@/lib/training/garmin-activity-match-helpers";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type WorkoutActivityMatchReason =
  | "title_match"
  | "same_day"
  | "distance_close";

export const WORKOUT_ACTIVITY_MATCH_REASON_LABELS: Record<
  WorkoutActivityMatchReason,
  string
> = {
  title_match: "Title match",
  same_day: "Same day",
  distance_close: "Distance close",
};

export type ActivityCandidateInput = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: Date | null;
  duration: number | null;
  distance: number | null;
  averageSpeed: number | null;
  ingestionStatus: string;
  summaryData: unknown;
  matchedWorkoutId: string | null;
  matchedWorkoutTitle: string | null;
};

export type ScoredActivityCandidate = ActivityCandidateInput & {
  reasons: WorkoutActivityMatchReason[];
  reasonLabels: string[];
  score: number;
  paceSecPerMile: number | null;
  activityYmd: string | null;
};

function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function utcCalendarDaysApart(aYmd: string, bYmd: string): number {
  const a = new Date(`${aYmd}T00:00:00.000Z`);
  const b = new Date(`${bYmd}T00:00:00.000Z`);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function isDistanceClose(
  activityMeters: number | null,
  workoutMeters: number | null | undefined
): boolean {
  if (
    activityMeters == null ||
    activityMeters <= 0 ||
    workoutMeters == null ||
    workoutMeters <= 0
  ) {
    return false;
  }
  const deltaMi = Math.abs(activityMeters - workoutMeters) / 1609.34;
  const pct = Math.abs(activityMeters - workoutMeters) / workoutMeters;
  return deltaMi <= 1.5 || pct <= 0.2;
}

/** Expand workout calendar day ±1 for candidate activity window. */
export function workoutMatchCandidateDateRange(workoutDate: Date | null): {
  start: Date;
  end: Date;
} | null {
  if (!workoutDate) return null;
  const centerYmd = ymdFromDate(workoutDate);
  const startYmdDate = new Date(`${centerYmd}T00:00:00.000Z`);
  startYmdDate.setUTCDate(startYmdDate.getUTCDate() - 1);
  const endYmdDate = new Date(`${centerYmd}T00:00:00.000Z`);
  endYmdDate.setUTCDate(endYmdDate.getUTCDate() + 2);
  return { start: startYmdDate, end: endYmdDate };
}

export function scoreActivityCandidateForWorkout(params: {
  workout: {
    id: string;
    title: string;
    weekNumber: number | null;
    date: Date | null;
    estimatedDistanceInMeters: number | null | undefined;
  };
  activity: ActivityCandidateInput;
}): ScoredActivityCandidate | null {
  const { workout, activity } = params;
  if (!activity.startTime) return null;

  const summary = activity.summaryData as Record<string, unknown> | null;
  const activityYmd = activityLocalYmdFromSummary(activity.startTime, summary);
  const workoutYmd = workout.date ? ymdFromDate(workout.date) : null;

  if (workoutYmd != null) {
    const daysApart = Math.abs(utcCalendarDaysApart(activityYmd, workoutYmd));
    if (daysApart > 1) return null;
  }

  const reasons: WorkoutActivityMatchReason[] = [];
  let score = 0;

  if (
    activityNameContainsPushedWorkoutTitle({
      activityName: activity.activityName,
      workoutTitle: workout.title,
      weekNumber: workout.weekNumber,
    })
  ) {
    reasons.push("title_match");
    score += 1000;
  }

  if (workoutYmd != null && activityYmd === workoutYmd) {
    reasons.push("same_day");
    score += 100;
  }

  if (isDistanceClose(activity.distance, workout.estimatedDistanceInMeters)) {
    reasons.push("distance_close");
    score += 20;
  }

  if (reasons.length === 0 && workoutYmd != null && activityYmd === workoutYmd) {
    reasons.push("same_day");
    score += 100;
  } else if (reasons.length === 0) {
    score += 5;
  }

  score += activity.startTime.getTime() / 1_000_000_000;

  return {
    ...activity,
    reasons,
    reasonLabels: reasons.map((r) => WORKOUT_ACTIVITY_MATCH_REASON_LABELS[r]),
    score,
    paceSecPerMile: speedMpsToSecPerMile(activity.averageSpeed),
    activityYmd,
  };
}

export function scoreAndSortActivityCandidates(params: {
  workout: {
    id: string;
    title: string;
    weekNumber: number | null;
    date: Date | null;
    estimatedDistanceInMeters: number | null | undefined;
  };
  activities: ActivityCandidateInput[];
}): ScoredActivityCandidate[] {
  const scored = params.activities
    .map((activity) =>
      scoreActivityCandidateForWorkout({ workout: params.workout, activity })
    )
    .filter((row): row is ScoredActivityCandidate => row != null);

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** UTC day range for ±1 day around workout date (inclusive window for DB query). */
export function workoutMatchCandidateUtcRange(workoutDate: Date | null): {
  start: Date;
  end: Date;
} | null {
  if (!workoutDate) return null;
  const centerYmd = ymdFromDate(workoutDate);
  const prev = new Date(`${centerYmd}T00:00:00.000Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = utcDayRangeFromYmd(centerYmd).end;
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: prev, end: next };
}
