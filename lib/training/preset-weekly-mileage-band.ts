/** Resolve min/max weekly miles from a catalog preset summary (Training Manage). */
export function presetWeeklyMilesBand(
  preset:
    | {
        minWeeklyMiles?: number | null;
        maxWeeklyMiles?: number | null;
      }
    | null
    | undefined
): { min: number; max: number | null } {
  const rawMin = preset?.minWeeklyMiles;
  const min =
    rawMin != null && Number.isFinite(Number(rawMin))
      ? Math.max(1, Math.round(Number(rawMin)))
      : 40;
  const rawMax = preset?.maxWeeklyMiles;
  const max =
    rawMax != null && Number.isFinite(Number(rawMax))
      ? Math.max(min, Math.round(Number(rawMax)))
      : null;
  return { min, max };
}

export function clampWeeklyMilesToPresetBand(
  miles: number,
  band: { min: number; max: number | null }
): number {
  let n = Math.round(miles);
  if (n < band.min) n = band.min;
  if (band.max != null && n > band.max) n = band.max;
  return n;
}

export function weeklyMileageTargetWithinPresetBand(
  miles: number,
  band: { min: number; max: number | null }
): boolean {
  const n = Math.round(miles);
  if (n < band.min) return false;
  if (band.max != null && n > band.max) return false;
  return true;
}

export function presetWeeklyBandErrorLabel(band: { min: number; max: number | null }): string {
  return band.max != null
    ? `${band.min}–${band.max} mi/week`
    : `at least ${band.min} mi/week`;
}
