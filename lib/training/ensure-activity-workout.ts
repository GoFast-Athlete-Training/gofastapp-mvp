export type PromoteActivityResult = {
  promoted: boolean;
  workoutId?: string;
  alreadyLinked?: boolean;
  blockedByPlannedWorkout?: boolean;
};

export type EnsureActivityWorkoutOutcome =
  | { ok: true; workoutId: string; alreadyLinked: boolean }
  | {
      ok: false;
      reason: 'blocked_by_planned_workout' | 'could_not_promote';
      message: string;
    };

export function mapPromoteToEnsureWorkout(
  result: PromoteActivityResult
): EnsureActivityWorkoutOutcome {
  if (result.promoted && result.workoutId?.trim()) {
    return {
      ok: true,
      workoutId: result.workoutId,
      alreadyLinked: Boolean(result.alreadyLinked),
    };
  }

  if (result.blockedByPlannedWorkout) {
    return {
      ok: false,
      reason: 'blocked_by_planned_workout',
      message:
        'This run looks like it belongs to a planned workout. Match it from Training first.',
    };
  }

  return {
    ok: false,
    reason: 'could_not_promote',
    message: 'Could not attach a workout to this activity.',
  };
}
