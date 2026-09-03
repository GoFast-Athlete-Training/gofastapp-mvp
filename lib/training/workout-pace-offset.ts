/** What-pace presets — sec/mi vs athlete 5K anchor (positive = slower). Mirrors Company canon. */
export const WHAT_PACE_PRESETS = [
  { id: "5k", label: "5K", offset: 0 },
  { id: "10k", label: "10K", offset: 15 },
  { id: "tempo", label: "Tempo", offset: 15 },
  { id: "marathon", label: "Marathon", offset: 45 },
  { id: "interval", label: "Interval", offset: -10 },
] as const;

export type WhatPacePresetId = (typeof WHAT_PACE_PRESETS)[number]["id"];

export function presetIdForWorkoutOffset(
  offset: number | null
): WhatPacePresetId | "custom" {
  if (offset == null || !Number.isFinite(offset)) return "custom";
  const match = WHAT_PACE_PRESETS.find((p) => p.offset === offset);
  return match?.id ?? "custom";
}

export function formatWorkoutOffsetSummary(offset: number | null): string {
  if (offset == null || !Number.isFinite(offset)) return "";
  const sign = offset > 0 ? "+" : "";
  return `${sign}${offset} sec/mi vs 5K`;
}

/** Midpoint pace (sec/mi) minus 5K anchor → intended catalogue offset. */
export function inferOffsetSecPerMileFromPace(
  paceLowSecPerMile: number | null,
  paceHighSecPerMile: number | null,
  anchorSecPerMile: number
): number | null {
  if (paceLowSecPerMile == null || !Number.isFinite(paceLowSecPerMile)) return null;
  const high =
    paceHighSecPerMile != null && Number.isFinite(paceHighSecPerMile)
      ? paceHighSecPerMile
      : paceLowSecPerMile;
  const mid = Math.round((paceLowSecPerMile + high) / 2);
  return mid - Math.round(anchorSecPerMile);
}

/** Shift prescribed band by delta sec/mi (preserves width). */
export function shiftPaceBandSecPerMile(
  low: number,
  high: number | null,
  deltaSecPerMile: number
): { low: number; high: number } {
  const hi = high ?? low;
  return {
    low: Math.max(1, Math.round(low + deltaSecPerMile)),
    high: Math.max(1, Math.round(hi + deltaSecPerMile)),
  };
}

export function isWorkBlockEligibleForPaceOffset(params: {
  title: string;
  hasPaceTarget: boolean;
  conversational: boolean;
}): boolean {
  if (params.conversational || !params.hasPaceTarget) return false;
  const t = (params.title || "").toLowerCase();
  if (t.includes("warm") || t.includes("cool")) return false;
  if (/\brecovery\b|\bjog\b/.test(t)) return false;
  return true;
}
