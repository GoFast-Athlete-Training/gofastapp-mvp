/**
 * Validate athlete tempo / interval day choices for PATCH and setup UI.
 */

export function validatePreferredTempoInterval(params: {
  preferredTempoDow: number | null;
  preferredIntervalDow: number | null;
  preferredLongRunDow: number | null | undefined;
  preferredDays: number[];
}): { ok: true } | { ok: false; error: string } {
  const {
    preferredTempoDow: tempo,
    preferredIntervalDow: interval,
    preferredLongRunDow: lr,
    preferredDays,
  } = params;

  const prefSet = new Set(
    preferredDays.filter((d) => typeof d === "number" && d >= 1 && d <= 7)
  );

  for (const [label, d] of [
    ["Tempo", tempo],
    ["Interval", interval],
  ] as const) {
    if (d == null) continue;
    if (!Number.isInteger(d) || d < 1 || d > 7) {
      return { ok: false, error: `${label} day must be between 1 (Mon) and 7 (Sun)` };
    }
    if (!prefSet.has(d)) {
      return { ok: false, error: `${label} day must be one of your preferred training days` };
    }
    if ((lr === 6 || lr === 7) && d === lr) {
      return { ok: false, error: `${label} day cannot be the same as your long run day` };
    }
  }

  if (tempo != null && interval != null) {
    if (tempo === interval) {
      return { ok: false, error: "Tempo and interval must be on different days" };
    }
    const sorted = [tempo, interval].sort((a, b) => a - b);
    if (sorted[1]! - sorted[0]! < 2) {
      return {
        ok: false,
        error: "Tempo and interval days must be at least two weekdays apart",
      };
    }
  }

  return { ok: true };
}
