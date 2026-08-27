import { COMMON_RACE_DISTANCE_PRESETS } from "@/lib/training/race-distance-presets";
import {
  canonicalDistanceLabelFromText,
  inferDistanceMetersFromLabel,
  metersForCanonicalDistanceLabel,
} from "@/lib/training/race-distance-infer";

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
  const canonical = canonicalDistanceLabelFromText(t);
  if (!canonical) {
    return {
      ok: false,
      error: `targetDistanceLabel must be one of: ${[...ALLOWED_TARGET_LABELS].sort().join(", ")}`,
    };
  }
  return { ok: true, value: canonical };
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

function finiteMeters(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value));
}

/** Working-set first: athlete_races snapshot, then race_registry origin. */
export function resolveRaceDistanceMeters(
  athleteRaceMeters: number | null | undefined,
  registryMeters: number | null | undefined
): number | null {
  const athlete = finiteMeters(athleteRaceMeters);
  if (athlete != null) return athlete;
  return finiteMeters(registryMeters);
}

/** Display label from confirmed meters, or from a distance string (aliases). Never from race name. */
export function resolveRaceDistanceLabel(
  meters: number | null | undefined,
  distanceLabel?: string | null
): string | null {
  const snapped = snapDistanceLabelFromMeters(meters);
  if (snapped) return snapped;
  return canonicalDistanceLabelFromText(distanceLabel);
}

/** Meters for a staff preset's targetDistanceLabel (null = any distance). */
export function presetTargetDistanceMeters(
  presetLabel: string | null | undefined
): number | null {
  if (!presetLabel?.trim()) return null;
  return metersForCanonicalDistanceLabel(presetLabel.trim());
}

export type RaceDistanceMatchInput = {
  athleteRaceMeters?: number | null;
  registryMeters?: number | null;
  /** Display / pre-fill only — not used when athleteRaceMeters is set. */
  distanceLabel?: string | null;
};

/** Canonical race distance for preset filtering and create-plan validation. */
export function raceDistanceForPresetMatch(input: RaceDistanceMatchInput): {
  meters: number | null;
  label: string | null;
} {
  const meters = resolveRaceDistanceMeters(
    input.athleteRaceMeters,
    input.registryMeters
  );
  const label = resolveRaceDistanceLabel(meters, input.distanceLabel);
  return { meters, label };
}

/** True if preset is compatible with the given race distance (null preset label = any). */
export function presetMatchesDistance(
  presetLabel: string | null | undefined,
  raceMeters: number | null | undefined
): boolean {
  if (!presetLabel?.trim()) return true;
  const presetMeters = presetTargetDistanceMeters(presetLabel);
  const raceM = finiteMeters(raceMeters);
  if (presetMeters == null || raceM == null) return false;
  return Math.abs(presetMeters - raceM) <= SNAP_TOLERANCE_M;
}

/** True when preset distance matches athlete race snapshot meters (registry fallback only when snapshot empty). */
export function presetMatchesRaceDistance(
  presetLabel: string | null | undefined,
  input: RaceDistanceMatchInput
): boolean {
  const { meters } = raceDistanceForPresetMatch(input);
  return presetMatchesDistance(presetLabel, meters);
}

/** Parse distance input (label, 26.2, etc.) to canonical label + meters for forms/CSV. */
export function normalizeDistanceInput(raw: string | null | undefined): {
  label: string | null;
  meters: number | null;
} {
  const label = canonicalDistanceLabelFromText(raw);
  const meters =
    label != null
      ? metersForCanonicalDistanceLabel(label)
      : inferDistanceMetersFromLabel(raw);
  const snappedLabel =
    meters != null ? snapDistanceLabelFromMeters(meters) : label;
  return { label: snappedLabel, meters: meters ?? null };
}
