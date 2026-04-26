/**
 * Defaults for the long-run engine taper block when no explicit override is passed.
 */

export function defaultTaperLongRunsForWeeks(taperWeeks: number): number[] {
  const t = Math.max(1, Math.min(6, Math.round(taperWeeks)));
  if (t === 1) return [5];
  if (t === 2) return [12, 8];
  if (t === 3) return [15, 10, 5];
  if (t === 4) return [18, 14, 10, 6];
  return Array.from({ length: t }, (_, i) => Math.max(0, 20 - i * 4));
}
