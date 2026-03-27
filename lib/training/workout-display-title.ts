/**
 * Short, Runna-style titles for planned workouts: "Easy 6 miles", "Tempo work 5 miles".
 */

const MI_PER_M = 1609.34;

export function formatMilesFromMeters(
  estimatedDistanceInMeters: number | null | undefined
): string {
  if (
    estimatedDistanceInMeters == null ||
    !Number.isFinite(estimatedDistanceInMeters)
  ) {
    return "";
  }
  const mi = estimatedDistanceInMeters / MI_PER_M;
  const rounded =
    Math.abs(mi - Math.round(mi)) < 0.06 ? Math.round(mi) : Math.round(mi * 10) / 10;
  const unit = rounded === 1 ? "mile" : "miles";
  return `${rounded} ${unit}`;
}

export function formatPlannedWorkoutTitle(
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined,
  opts?: { isRace?: boolean; raceName?: string }
): string {
  if (opts?.isRace && opts.raceName?.trim()) {
    return `Race — ${opts.raceName.trim()}`;
  }

  const dist = formatMilesFromMeters(estimatedDistanceInMeters);
  const d = dist ? ` ${dist}` : "";

  switch (workoutType) {
    case "Easy":
      return dist ? `Easy${d}` : "Easy run";
    case "Tempo":
      return dist ? `Tempo work${d}` : "Tempo run";
    case "Intervals":
      return dist ? `Intervals${d}` : "Intervals";
    case "LongRun":
      return dist ? `Long run${d}` : "Long run";
    default:
      return dist ? `Run${d}` : "Workout";
  }
}

/** Prefer stored race title; fix legacy "— Week N" titles; keep other custom titles. */
export function displayWorkoutListTitle(workout: {
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
}): string {
  const raw = workout.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;
  if (/\b—\s*Week\s*\d+/i.test(raw) || /\bWeek\s*\d+\s*$/i.test(raw)) {
    return formatPlannedWorkoutTitle(
      workout.workoutType,
      workout.estimatedDistanceInMeters
    );
  }
  if (raw.length > 0) return raw;
  return formatPlannedWorkoutTitle(
    workout.workoutType,
    workout.estimatedDistanceInMeters
  );
}
