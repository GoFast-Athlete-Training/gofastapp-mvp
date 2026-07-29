/**
 * Garmin Connect: garminWorkoutId is the universal truth for "sent to Garmin".
 * Calendar placement uses POST /schedule { workoutId, date } on first push only.
 */

export type GarminPushMode = "schedule-today" | "update-library" | "force-reschedule";

export type GarminCalendarSyncState =
  | "not_pushed"
  | "library_only"
  | "scheduled_on_calendar";

export function garminCalendarSyncState(workout: {
  garminWorkoutId?: number | null;
  garminScheduleId?: number | null;
}): GarminCalendarSyncState {
  if (workout.garminWorkoutId != null) return "scheduled_on_calendar";
  return "not_pushed";
}

export function garminCalendarStateLabel(state: GarminCalendarSyncState): string {
  switch (state) {
    case "scheduled_on_calendar":
      return "On Garmin Connect Training Calendar";
    case "library_only":
      return "In Garmin workout library only";
    default:
      return "Not sent to Garmin";
  }
}

/** Default push mode for manual UI actions from current DB state. */
export function defaultGarminPushModeForState(
  state: GarminCalendarSyncState
): GarminPushMode {
  switch (state) {
    case "scheduled_on_calendar":
      return "update-library";
    case "library_only":
      return "update-library";
    default:
      return "schedule-today";
  }
}

export type PushWorkoutToGarminOptions = {
  scheduleDateYmdOverride?: string;
  mode?: GarminPushMode;
};

export function normalizePushWorkoutOptions(
  third?: string | PushWorkoutToGarminOptions
): PushWorkoutToGarminOptions {
  if (third == null) return {};
  if (typeof third === "string") {
    return { scheduleDateYmdOverride: third.trim() || undefined };
  }
  return third;
}

export function parseGarminPushModeFromBody(
  body: Record<string, unknown> | null | undefined
): GarminPushMode | undefined {
  if (!body || typeof body !== "object") return undefined;
  const raw = body.mode;
  if (raw === "schedule-today" || raw === "update-library" || raw === "force-reschedule") {
    return raw;
  }
  return undefined;
}
