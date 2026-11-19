import { inferSegmentKind } from "@/lib/group-workout-segment-editor";
import {
  distanceUnitForDayPaceEdit,
  formatDistanceForDayPaceEdit,
  parseDayPaceDistanceInput,
  type DayPaceEditorKind,
} from "@/lib/training/day-plan-pace-splits-editor";
import { isRecoveryTitle } from "@/lib/training/segment-summary";

export type WorkoutCardDistanceUnit = "mi" | "m";

/** Work card vs the recovery jog paired under it. Warmup and cooldown stay in miles. */
export function workoutCardDistanceKind(
  title: string,
  role: "work" | "recovery" = "work"
): DayPaceEditorKind {
  if (role === "recovery" || isRecoveryTitle(title)) return "recovery";
  if (inferSegmentKind(title) === "warmup") return "warmup";
  if (inferSegmentKind(title) === "cooldown") return "cooldown";
  return "work";
}

/**
 * Distance shown on a Your workout card.
 * Track-length work and recovery render in meters. No override means the label
 * changed only — the caller must not treat that as an edit.
 */
export function workoutCardDistanceField(args: {
  storedMiles: number;
  kind: DayPaceEditorKind;
  overrideValue?: string;
  overrideUnit?: WorkoutCardDistanceUnit;
}): { value: string; unit: WorkoutCardDistanceUnit } {
  if (args.overrideValue !== undefined) {
    return { value: args.overrideValue, unit: args.overrideUnit ?? "mi" };
  }
  return {
    value: formatDistanceForDayPaceEdit(args.storedMiles, args.kind),
    unit: distanceUnitForDayPaceEdit(args.storedMiles, args.kind),
  };
}

/**
 * Miles string for the segments PUT.
 * Meter edits use full precision (400 / 1609.34), not a 3-decimal mile string,
 * so Garmin's round(miles * 1609.34) stays on the meter the athlete typed.
 * Unedited rows pass no unit and keep the stored mile string.
 */
export function quickSegmentDurationForSave(
  durationType: "DISTANCE" | "TIME",
  durationValue: string,
  distanceUnit: WorkoutCardDistanceUnit | undefined
): string {
  if (durationType !== "DISTANCE" || distanceUnit !== "m") return durationValue;
  const miles = parseDayPaceDistanceInput(durationValue, "m");
  if (!Number.isFinite(miles) || miles < 0) return durationValue;
  return String(miles);
}
