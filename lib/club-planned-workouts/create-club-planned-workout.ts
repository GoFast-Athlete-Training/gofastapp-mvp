import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";
import {
  upsertRunPlannedWorkoutForRun,
  type UpsertRunPlannedWorkoutInput,
} from "@/lib/run-planned-workouts/upsert-run-planned-workout";

export type CreateClubPlannedWorkoutInput = UpsertRunPlannedWorkoutInput;

/** @deprecated Use upsertRunPlannedWorkoutForRun — kept for club-planned-workout route compat */
export async function upsertClubPlannedWorkoutForRun(input: CreateClubPlannedWorkoutInput) {
  return upsertRunPlannedWorkoutForRun(input);
}

export type { GroupWorkoutSegmentInput };
