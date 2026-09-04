/**
 * Garmin push state: our stack stamp on planned_workouts.workoutPushed — not Garmin ids.
 */

export type GarminPushMode = "schedule-today";

export type GarminCalendarSyncState = "not_pushed" | "pushed";

export function garminCalendarSyncState(workout: {
  workoutPushed?: boolean | null;
}): GarminCalendarSyncState {
  return workout.workoutPushed ? "pushed" : "not_pushed";
}

export function garminCalendarStateLabel(state: GarminCalendarSyncState): string {
  switch (state) {
    case "pushed":
      return "Sent to Garmin";
    default:
      return "Not sent to Garmin";
  }
}

export type PushWorkoutToGarminOptions = {
  scheduleDateYmdOverride?: string;
  /** @deprecated Modes removed — always schedule on push. */
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
  _body: Record<string, unknown> | null | undefined
): GarminPushMode | undefined {
  return undefined;
}
