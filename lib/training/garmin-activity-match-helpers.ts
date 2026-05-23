import { ymdFromDate } from "@/lib/training/plan-utils";

/** Avoid double-prefixing when title already has GF W1: or W1: style week label. */
export function garminTitleForWorkout(workout: {
  title: string;
  weekNumber: number | null;
}): string {
  const title = workout.title.trim();
  if (/^(GF\s+)?W\d+\s*:/i.test(title)) return title;
  if (workout.weekNumber != null && Number.isFinite(workout.weekNumber)) {
    return `GF W${workout.weekNumber}: ${title}`;
  }
  return title;
}

export function normalizeGarminMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip Garmin location prefix before `GF W#:` and optional week label for title comparison. */
export function normalizeActivityNameForMatch(
  activityName: string | null | undefined
): string {
  let text = normalizeGarminMatchText(activityName);
  const gfMarker = text.match(/\bgf\s+w\d+\s*:/i);
  if (gfMarker?.index != null && gfMarker.index > 0) {
    text = text.slice(gfMarker.index);
  }
  text = text.replace(/^gf\s+w\d+\s*:\s*/i, "");
  return text.trim();
}

/** True when Garmin activity title looks like a pushed planned workout (GF W#: …). */
export function activityNameHasPushedWorkoutMarker(
  activityName: string | null | undefined
): boolean {
  return /\bgf\s+w\d+\s*:/i.test(activityName ?? "");
}

function numFromRecord(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function activityLocalYmdFromSummary(
  startTime: Date,
  summary: Record<string, unknown> | null
): string {
  const startTimeInSeconds = numFromRecord(summary, "startTimeInSeconds");
  const offsetSeconds = numFromRecord(summary, "startTimeOffsetInSeconds");
  if (startTimeInSeconds != null && offsetSeconds != null) {
    return ymdFromDate(new Date((startTimeInSeconds + offsetSeconds) * 1000));
  }
  return ymdFromDate(startTime);
}

export function utcDayRangeFromYmd(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function activityNameContainsPushedWorkoutTitle(params: {
  activityName: string | null | undefined;
  workoutTitle: string;
  weekNumber: number | null;
}): boolean {
  const activityName = normalizeGarminMatchText(params.activityName);
  const activityCore = normalizeActivityNameForMatch(params.activityName);
  const workoutTitle = normalizeGarminMatchText(params.workoutTitle);
  const pushedTitle = normalizeGarminMatchText(
    garminTitleForWorkout({
      title: params.workoutTitle,
      weekNumber: params.weekNumber,
    })
  );

  if (workoutTitle.length > 0 && activityCore === workoutTitle) {
    return true;
  }
  if (workoutTitle.length > 0 && activityCore.includes(workoutTitle)) {
    return true;
  }
  return pushedTitle.length > 0 && activityName.includes(pushedTitle);
}
