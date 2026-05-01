/**
 * Between-rep recovery for catalogue Intervals (flat ladder + legacy workBase reps).
 * Timed recovery takes precedence over distance when recoveryDurationSeconds > 0.
 */

function roundDecimals(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export type CatalogueBetweenRepRecovery =
  | { kind: "none" }
  | { kind: "time"; durationValueMinutes: number }
  | { kind: "distance"; durationValueMiles: number };

/**
 * @param entry.recoveryDurationSeconds — if finite and positive, materialize TIME recovery (minutes).
 * @param entry.recoveryDistanceMeters — else if 0 → no jog; else if positive → DISTANCE miles; else null → default 400 m.
 */
export function betweenRepRecoveryForMaterialization(entry: {
  recoveryDurationSeconds: number | null;
  recoveryDistanceMeters: number | null;
}): CatalogueBetweenRepRecovery {
  const tRaw = entry.recoveryDurationSeconds;
  if (tRaw != null) {
    const t = Number(tRaw);
    if (Number.isFinite(t) && t > 0) {
      return { kind: "time", durationValueMinutes: roundDecimals(t / 60, 4) };
    }
  }
  const dRaw = entry.recoveryDistanceMeters;
  if (dRaw != null) {
    const d = Number(dRaw);
    if (Number.isFinite(d)) {
      if (d === 0) return { kind: "none" };
      if (d > 0) {
        return { kind: "distance", durationValueMiles: roundDecimals(d / 1609.34, 3) };
      }
    }
  }
  return {
    kind: "distance",
    durationValueMiles: roundDecimals(400 / 1609.34, 3),
  };
}

/** Human-readable line for athlete-facing prescription previews (distance or time). */
export function describeBetweenRepRecovery(entry: {
  recoveryDurationSeconds: number | null;
  recoveryDistanceMeters: number | null;
}): string {
  const r = betweenRepRecoveryForMaterialization(entry);
  if (r.kind === "none") return "no scripted recovery jog";
  if (r.kind === "time") {
    const s = Math.round(r.durationValueMinutes * 60);
    return `${s}s recovery`;
  }
  return `${Math.round(r.durationValueMiles * 1609.34)}m recovery`;
}
