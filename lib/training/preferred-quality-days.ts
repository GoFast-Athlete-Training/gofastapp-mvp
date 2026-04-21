/**
 * Normalize athlete-selected quality session days before persisting or generating.
 * Quality days must lie in `preferredDays`, exclude the long-run day, max two entries,
 * and when two are set they must differ by at least 2 (e.g. Tue vs Thu).
 */
export function normalizePreferredQualityDays(
  raw: unknown,
  preferredDays: number[],
  longRunDow: number | null | undefined
): { ok: true; value: number[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "preferredQualityDays must be an array" };
  }
  const prefSet = new Set(
    preferredDays.filter((d) => typeof d === "number" && d >= 1 && d <= 7)
  );
  let days = raw
    .map((n) => Number(n))
    .filter((d) => d >= 1 && d <= 7 && prefSet.has(d));
  if (longRunDow === 6 || longRunDow === 7) {
    days = days.filter((d) => d !== longRunDow);
  }
  days = [...new Set(days)].sort((a, b) => a - b);
  if (days.length > 2) {
    return { ok: false, error: "At most two quality days are allowed" };
  }
  if (days.length === 2 && days[1] - days[0] < 2) {
    return {
      ok: false,
      error: "Quality days must be at least two calendar days apart",
    };
  }
  return { ok: true, value: days };
}
