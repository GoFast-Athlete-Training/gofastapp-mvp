/** Product completion: stamped actuals on a spawned workouts row — not garminDetailActivityId. */

export function workoutHasActuals(row: {
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
}): boolean {
  const dist = row.actualDistanceMeters;
  if (dist != null && Number.isFinite(dist) && dist > 0) return true;
  const dur = row.actualDurationSeconds;
  if (dur != null && Number.isFinite(dur) && dur > 0) return true;
  return false;
}

/** Planned day done — ingest stamp is canonical; actuals are legacy fallback. */
export function planDayIsCompleted(row: {
  workoutCompleted?: boolean;
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  skippedAt?: string | null;
}): boolean {
  if (row.workoutCompleted) return true;
  if (row.skippedAt) return true;
  return workoutHasActuals(row);
}
