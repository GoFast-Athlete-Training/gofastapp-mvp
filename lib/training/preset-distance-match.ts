import { COMMON_RACE_DISTANCE_PRESETS } from "@/lib/training/race-distance-presets";

const SNAP_TOLERANCE_M = 300;

const ALLOWED_TARGET_LABELS = new Set(
  COMMON_RACE_DISTANCE_PRESETS.map((p) => p.label)
);

/**
 * When key absent → undefined (do not update / use DB default).
 * When key present null/"" → null. String must be a known label.
 */
export function parseTargetDistanceLabelFromBody(body: Record<string, unknown>):
  | { ok: true; value: string | null | undefined }
  | { ok: false; error: string } {
  if (!("targetDistanceLabel" in body)) {
    return { ok: true, value: undefined };
  }
  const v = body.targetDistanceLabel;
  if (v === null || v === "") return { ok: true, value: null };
  if (typeof v !== "string") {
    return { ok: false, error: "targetDistanceLabel must be a string or null" };
  }
  const t = v.trim();
  if (!t) return { ok: true, value: null };
  if (!ALLOWED_TARGET_LABELS.has(t)) {
    return {
      ok: false,
      error: `targetDistanceLabel must be one of: ${[...ALLOWED_TARGET_LABELS].sort().join(", ")}`,
    };
  }
  return { ok: true, value: t };
}

/** Returns the canonical label for distanceMeters (e.g. 42195 → "Marathon"). */
export function snapDistanceLabelFromMeters(
  meters: number | null | undefined
): string | null {
  if (meters == null || !Number.isFinite(Number(meters))) return null;
  const m = Math.round(Number(meters));
  const match = COMMON_RACE_DISTANCE_PRESETS.find(
    (p) => Math.abs(p.meters - m) <= SNAP_TOLERANCE_M
  );
  return match?.label ?? null;
}

/** True if preset is compatible with the given race distance (null preset label = any). */
export function presetMatchesDistance(
  presetLabel: string | null | undefined,
  raceMeters: number | null | undefined
): boolean {
  if (!presetLabel?.trim()) return true;
  const raceLabel = snapDistanceLabelFromMeters(raceMeters);
  return raceLabel === presetLabel.trim();
}
