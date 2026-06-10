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

/** True when title matches Runna-style or AI fallback strings, not a custom/catalogue name. */
export function isGeneratedGenericWorkoutTitle(
  title: string,
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined
): boolean {
  const raw = title.trim();
  if (!raw) return true;
  if (/\b—\s*Week\s*\d+/i.test(raw) || /\bWeek\s*\d+\s*$/i.test(raw)) {
    return true;
  }

  const planned = formatPlannedWorkoutTitle(workoutType, estimatedDistanceInMeters);
  if (raw === planned) return true;

  const miles = formatMilesFromMeters(estimatedDistanceInMeters);
  if (miles) {
    const miNum = miles.replace(/\s*miles?$/, "").trim();
    if (new RegExp(`^${workoutType}\\s+${miNum.replace(".", "\\.")}\\s+Miles$`, "i").test(raw)) {
      return true;
    }
    if (new RegExp(`^${miNum.replace(".", "\\.")}\\s+Mile\\s+${workoutType}`, "i").test(raw)) {
      return true;
    }
  }

  return false;
}

/** Prefer catalogue or schedule-specific titles over stale generic materialized titles. */
export function resolveWorkoutDisplayTitle(workout: {
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
  catalogueName?: string | null;
  scheduleTitle?: string | null;
}): string {
  const raw = workout.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;

  const catalogueName = workout.catalogueName?.trim() || null;
  const scheduleTitle = workout.scheduleTitle?.trim() || null;
  const genericStored = isGeneratedGenericWorkoutTitle(
    raw,
    workout.workoutType,
    workout.estimatedDistanceInMeters
  );

  if (
    (workout.workoutType === "Tempo" || workout.workoutType === "Intervals") &&
    genericStored
  ) {
    if (catalogueName) return catalogueName;
    if (
      scheduleTitle &&
      !isGeneratedGenericWorkoutTitle(
        scheduleTitle,
        workout.workoutType,
        workout.estimatedDistanceInMeters
      )
    ) {
      return scheduleTitle;
    }
  }

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

/** Prefer stored race title; fix legacy "— Week N" titles; keep other custom titles. */
export function displayWorkoutListTitle(workout: {
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
  catalogueName?: string | null;
  scheduleTitle?: string | null;
}): string {
  return resolveWorkoutDisplayTitle(workout);
}

/** Merge materialized row title with schedule-resolved catalogue title. */
export function mergePlanDayTitle(params: {
  rowTitle?: string | null;
  scheduleTitle: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
}): string {
  const rowTitle = params.rowTitle?.trim() ?? "";
  if (
    rowTitle &&
    !isGeneratedGenericWorkoutTitle(
      rowTitle,
      params.workoutType,
      params.estimatedDistanceInMeters
    )
  ) {
    return rowTitle;
  }
  return params.scheduleTitle;
}
