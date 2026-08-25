/** Long-run macro block is always 4 consecutive weeks / Saturday long runs. Not user-editable. */
export const LONG_RUN_BLOCK_WEEKS = 4;

/** Read block weeks from cyclePoolData snapshot (legacy `cycleLen` alias for old plans). */
export function longRunBlockWeeksFromPoolData(data: unknown): number {
  if (data == null || typeof data !== "object") return LONG_RUN_BLOCK_WEEKS;
  const o = data as Record<string, unknown>;
  const raw = o.longRunCycleWeeks ?? o.cycleLen;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 1 && n <= 8) return n;
  }
  return LONG_RUN_BLOCK_WEEKS;
}
