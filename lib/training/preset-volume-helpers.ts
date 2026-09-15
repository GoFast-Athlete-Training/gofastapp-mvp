/**
 * Defaults for the long-run engine taper block when no explicit override is passed.
 */

export const TAPER_CALENDAR_WEEKS = 2;
export const TAPER_VOLUME_MULTIPLIER = 0.5;
/** Template peak single LR used to scale defaultTaperLongRunsForWeeks. */
export const TAPER_LR_TEMPLATE_PEAK_MILES = 21;

export function isTaperVolumeWeek(weekNumber: number, totalWeeks: number): boolean {
  const t = Math.max(1, Math.floor(totalWeeks));
  const w = Math.max(1, Math.floor(weekNumber));
  return w >= t - TAPER_CALENDAR_WEEKS + 1;
}

export function taperWeeklyMileageTarget(normalWeeklyTarget: number): number {
  const base = Number(normalWeeklyTarget);
  if (!Number.isFinite(base) || base <= 0) return base;
  return Math.round(base * TAPER_VOLUME_MULTIPLIER * 100) / 100;
}

export function defaultTaperLongRunsForWeeks(taperWeeks: number): number[] {
  const t = Math.max(1, Math.min(6, Math.round(taperWeeks)));
  if (t === 1) return [5];
  if (t === 2) return [12, 8];
  if (t === 3) return [15, 10, 5];
  if (t === 4) return [18, 14, 10, 6];
  return Array.from({ length: t }, (_, i) => Math.max(0, 20 - i * 4));
}
