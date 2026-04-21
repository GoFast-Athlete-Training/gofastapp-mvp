/**
 * Defaults and normalization for preset volume bolton (taper array, etc.).
 */

export function defaultTaperLongRunsForWeeks(taperWeeks: number): number[] {
  const t = Math.max(1, Math.min(6, Math.round(taperWeeks)));
  if (t === 1) return [5];
  if (t === 2) return [12, 8];
  if (t === 3) return [15, 10, 5];
  if (t === 4) return [18, 14, 10, 6];
  return Array.from({ length: t }, (_, i) => Math.max(0, 20 - i * 4));
}

/** Ensure taperLongRuns length matches taperWeeks; pad/trim with numeric values. */
export function normalizeTaperLongRuns(taperWeeks: number, raw: unknown): number[] {
  const t = Math.max(1, Math.min(6, Math.round(taperWeeks)));
  if (Array.isArray(raw) && raw.length > 0) {
    const nums = raw.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
    const out = [...nums];
    while (out.length < t) {
      out.push(out[out.length - 1] ?? 0);
    }
    return out.slice(0, t);
  }
  return defaultTaperLongRunsForWeeks(t);
}
