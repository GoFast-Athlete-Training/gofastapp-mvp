/**
 * Try to read Garmin's structured-workout id from activity summary / webhook payload.
 * Field names vary by Garmin API version; check several common keys.
 */
export function extractGarminWorkoutIdFromSummary(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const tryNum = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };

  const nested =
    o.summary && typeof o.summary === "object"
      ? (o.summary as Record<string, unknown>)
      : null;

  const candidates = [
    o.parentWorkoutId,
    o.workoutId,
    o.trainingWorkoutId,
    o.trainingPlanWorkoutId,
    o.manualWorkoutId,
    nested?.parentWorkoutId,
    nested?.workoutId,
    nested?.trainingWorkoutId,
  ];

  for (const c of candidates) {
    const n = tryNum(c);
    if (n != null) return n;
  }
  return null;
}
