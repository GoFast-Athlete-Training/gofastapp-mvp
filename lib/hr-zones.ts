/**
 * MVP1 HR zone util: map zone names (e.g. "zone 2", "z2") to simple BPM ranges.
 * Uses fixed average ranges, not % of max HR.
 */

export const HR_ZONE_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 100, max: 115 },
  2: { min: 115, max: 130 },
  3: { min: 130, max: 145 },
  4: { min: 145, max: 160 },
  5: { min: 160, max: 175 },
};

const ZONE_PATTERN = /(?:^|\s)(?:zone\s*)?(\d)(?:\s|$)/i;

/**
 * Parse "zone 2", "z2", "zone2" etc. to BPM range.
 * Returns null if not a zone string.
 */
export function parseHzoneToBpm(input: string | null | undefined): { min: number; max: number } | null {
  if (input == null || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(ZONE_PATTERN) ?? trimmed.match(/^z(\d)$/i);
  const zoneNum = match ? parseInt(match[1], 10) : parseInt(trimmed, 10);
  if (zoneNum >= 1 && zoneNum <= 5 && Number.isFinite(zoneNum)) {
    return HR_ZONE_RANGES[zoneNum] ?? null;
  }
  return null;
}

/**
 * Format BPM range for display, e.g. "115–130 bpm"
 */
export function formatHrRange(min: number, max: number): string {
  return `${min}–${max} bpm`;
}
