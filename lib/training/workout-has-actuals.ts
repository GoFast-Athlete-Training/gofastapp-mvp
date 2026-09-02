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
