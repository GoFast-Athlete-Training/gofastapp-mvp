/**
 * Short, Runna-style titles for planned workouts: "Monday Easy 6 miles", "Wednesday Tempo work 5 miles".
 */

const MI_PER_M = 1609.34;

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type PlannedWorkoutTitleOpts = {
  isRace?: boolean;
  raceName?: string;
  /** Full day name, e.g. Monday — prefixed on generic planned titles. */
  dayAssigned?: string | null;
};

function normalizeDayAssigned(dayAssigned: string | null | undefined): string | null {
  const raw = dayAssigned?.trim();
  if (!raw) return null;
  const match = DAY_NAMES.find((d) => d.toLowerCase() === raw.toLowerCase());
  return match ?? null;
}

function workoutTypeShortLabel(workoutType: string): string {
  switch (workoutType) {
    case "Easy":
      return "Easy";
    case "Tempo":
      return "Tempo";
    case "Intervals":
      return "Intervals";
    case "LongRun":
      return "Long run";
    case "Race":
      return "Race";
    default:
      return "Workout";
  }
}

/**
 * Short day + type label for planned workouts, e.g. "Tuesday Tempo".
 * Used for list display, Garmin push names, and activity title matching.
 */
export function canonicalPlannedWorkoutTitle(workout: {
  title: string;
  workoutType: string;
  dayAssigned?: string | null;
  planId?: string | null;
}): string | null {
  if (workout.planId == null) return null;
  const raw = workout.title.trim();
  if (/^Race\s*—/i.test(raw) || workout.workoutType === "Race") {
    return raw.length > 0 ? raw : null;
  }
  const day = normalizeDayAssigned(workout.dayAssigned);
  if (!day) return null;
  return `${day} ${workoutTypeShortLabel(workout.workoutType)}`;
}

/** Strip a leading weekday from titles like "Monday Easy 6 miles". */
export function stripLeadingDayNameFromTitle(title: string): string {
  const raw = title.trim();
  if (!raw) return raw;
  for (const day of DAY_NAMES) {
    const prefix = `${day} `;
    if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
      return raw.slice(prefix.length).trim();
    }
  }
  return raw;
}

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

/** Core Runna-style title without weekday prefix. */
export function formatCorePlannedWorkoutTitle(
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined,
  opts?: Pick<PlannedWorkoutTitleOpts, "isRace" | "raceName">
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

export function formatPlannedWorkoutTitle(
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined,
  opts?: PlannedWorkoutTitleOpts
): string {
  const core = formatCorePlannedWorkoutTitle(workoutType, estimatedDistanceInMeters, opts);
  if (opts?.isRace) return core;

  const day = normalizeDayAssigned(opts?.dayAssigned);
  if (day) return `${day} ${core}`;
  return core;
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

  const withoutDay = stripLeadingDayNameFromTitle(raw);
  const planned = formatCorePlannedWorkoutTitle(workoutType, estimatedDistanceInMeters);
  if (withoutDay === planned || raw === planned) return true;

  const miles = formatMilesFromMeters(estimatedDistanceInMeters);
  if (miles) {
    const miNum = miles.replace(/\s*miles?$/, "").trim();
    if (
      new RegExp(`^${workoutType}\\s+${miNum.replace(".", "\\.")}\\s+Miles$`, "i").test(
        withoutDay
      )
    ) {
      return true;
    }
    if (
      new RegExp(`^${miNum.replace(".", "\\.")}\\s+Mile\\s+${workoutType}`, "i").test(
        withoutDay
      )
    ) {
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
  dayAssigned?: string | null;
  planId?: string | null;
}): string {
  const raw = workout.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;

  const canonical = canonicalPlannedWorkoutTitle(workout);
  if (canonical) return canonical;

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
    return formatCorePlannedWorkoutTitle(
      workout.workoutType,
      workout.estimatedDistanceInMeters
    );
  }
  if (genericStored && scheduleTitle) return scheduleTitle;
  if (raw.length > 0) return raw;
  return formatCorePlannedWorkoutTitle(
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
  dayAssigned?: string | null;
  planId?: string | null;
}): string {
  return resolveWorkoutDisplayTitle(workout);
}

/** Merge materialized row title with schedule-resolved catalogue title. */
export function mergePlanDayTitle(params: {
  rowTitle?: string | null;
  scheduleTitle: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
  dayAssigned?: string | null;
  planId?: string | null;
}): string {
  const canonical = canonicalPlannedWorkoutTitle({
    title: params.rowTitle?.trim() || params.scheduleTitle,
    workoutType: params.workoutType,
    dayAssigned: params.dayAssigned,
    planId: params.planId,
  });
  if (canonical) return canonical;

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
