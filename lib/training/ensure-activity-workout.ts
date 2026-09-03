export type EnsureActivityWorkoutOutcome =
  | { ok: true; workoutId: string; alreadyLinked: boolean }
  | {
      ok: false;
      reason: "could_not_seed";
      message: string;
    };

export function mapSeedToEnsureWorkout(result: {
  workoutId: string | null;
  alreadyLinked?: boolean;
}): EnsureActivityWorkoutOutcome {
  if (result.workoutId?.trim()) {
    return {
      ok: true,
      workoutId: result.workoutId,
      alreadyLinked: Boolean(result.alreadyLinked),
    };
  }

  return {
    ok: false,
    reason: "could_not_seed",
    message: "Could not attach a workout to this activity.",
  };
}
