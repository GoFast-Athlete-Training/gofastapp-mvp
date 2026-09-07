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

function extractMilesFromTitle(title: string): number | null {
  const match = title.match(/(\d+(?:\.\d+)?)\s*miles?\b/i);
  if (!match) return null;
  const mi = Number(match[1]);
  return Number.isFinite(mi) ? mi : null;
}

function titleHasStaleEmbeddedMiles(
  title: string,
  estimatedDistanceInMeters: number | null | undefined
): boolean {
  if (
    estimatedDistanceInMeters == null ||
    !Number.isFinite(estimatedDistanceInMeters) ||
    estimatedDistanceInMeters <= 0
  ) {
    return false;
  }
  const embeddedMi = extractMilesFromTitle(title);
  if (embeddedMi == null) return false;
  const plannedMi = estimatedDistanceInMeters / MI_PER_M;
  return Math.abs(embeddedMi - plannedMi) >= 0.15;
}

/** Prefer catalogue or schedule-specific titles over generic day+type labels. */
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

  const catalogueName = workout.catalogueName?.trim() || null;
  const scheduleTitle = workout.scheduleTitle?.trim() || null;
  const genericStored = isGeneratedGenericWorkoutTitle(
    raw,
    workout.workoutType,
    workout.estimatedDistanceInMeters
  );

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

  if (raw.length > 0 && !genericStored) {
    if (titleHasStaleEmbeddedMiles(raw, workout.estimatedDistanceInMeters)) {
      return formatPlannedWorkoutTitle(
        workout.workoutType,
        workout.estimatedDistanceInMeters,
        { dayAssigned: workout.dayAssigned }
      );
    }
    return raw;
  }

  if (/\b—\s*Week\s*\d+/i.test(raw) || /\bWeek\s*\d+\s*$/i.test(raw)) {
    return formatCorePlannedWorkoutTitle(
      workout.workoutType,
      workout.estimatedDistanceInMeters
    );
  }

  const canonical = canonicalPlannedWorkoutTitle(workout);
  if (canonical) return canonical;

  if (genericStored && scheduleTitle) return scheduleTitle;
  if (raw.length > 0) return raw;
  return formatCorePlannedWorkoutTitle(
    workout.workoutType,
    workout.estimatedDistanceInMeters
  );
}

/**
 * Title lanes — do not mix:
 * - `publicTitle` — athlete-facing title (reflection PATCH only). Wins in UI.
 * - `workouts.title` — planner/materialize key (`Saturday Long run 19.6 miles`). Match + generic detection only.
 * - Garmin send — `GF W{n}: …` — push/match only; never stack header or home card.
 */
export type PlanDisplayTitleInput = {
  weekNumber?: number | null;
  workoutType: string;
  estimatedDistanceInMeters?: number | null;
  catalogueName?: string | null;
  publicTitle?: string | null;
  title: string;
};

function formatPlannedHeadline(
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined
): string {
  const core = formatCorePlannedWorkoutTitle(workoutType, estimatedDistanceInMeters);
  switch (workoutType) {
    case "Easy":
      return core === "Easy run" ? "Easy Run" : core.replace(/^Easy /, "Easy Run ");
    case "Tempo":
      return core.replace(/^Tempo work /, "Tempo Work ").replace(/^Tempo run$/, "Tempo Work");
    case "LongRun":
      return core.replace(/^Long run /, "Long Run ").replace(/^Long run$/, "Long Run");
    case "Intervals":
      return core;
    default:
      return core.replace(/^Run /, "Workout ").replace(/^Workout$/, "Workout");
  }
}

function isPlannerKeyTitle(
  raw: string,
  workoutType: string,
  estimatedDistanceInMeters: number | null | undefined
): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^GF\s+W\d/i.test(trimmed)) return true;
  return isGeneratedGenericWorkoutTitle(trimmed, workoutType, estimatedDistanceInMeters ?? null);
}

function inferPlanHeadline(input: Omit<PlanDisplayTitleInput, "publicTitle" | "weekNumber">): string {
  const raw = input.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;

  const catalogue = input.catalogueName?.trim();
  if (catalogue) return catalogue;

  const meters = input.estimatedDistanceInMeters ?? null;

  if (!isPlannerKeyTitle(raw, input.workoutType, meters)) {
    const stripped = stripLeadingDayNameFromTitle(raw);
    const withoutMiles = stripped.replace(
      /(?:\s*[-–—]\s*|\s+)\d+(\.\d+)?\s*(mi|mile|miles)\b.*$/i,
      ""
    ).trim();
    return withoutMiles || formatPlannedHeadline(input.workoutType, meters);
  }

  return formatPlannedHeadline(input.workoutType, meters);
}

/** Athlete-facing plan title: publicTitle → Week {n}: headline. Never GF W# or raw planner key. */
export function formatPlanDisplayTitle(input: PlanDisplayTitleInput): string {
  const custom = input.publicTitle?.trim();
  if (custom) return custom;

  const headline = inferPlanHeadline(input);
  const week = input.weekNumber;
  if (week != null && Number.isFinite(week) && week > 0) {
    return `Week ${week}: ${headline}`;
  }
  return headline;
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
  const rowTitle = params.rowTitle?.trim() ?? "";
  const scheduleTitle = params.scheduleTitle?.trim() ?? "";

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

  if (
    scheduleTitle &&
    !isGeneratedGenericWorkoutTitle(
      scheduleTitle,
      params.workoutType,
      params.estimatedDistanceInMeters
    )
  ) {
    return scheduleTitle;
  }

  const canonical = canonicalPlannedWorkoutTitle({
    title: rowTitle || scheduleTitle,
    workoutType: params.workoutType,
    dayAssigned: params.dayAssigned,
    planId: params.planId,
  });
  if (canonical) return canonical;

  return scheduleTitle || rowTitle;
}
