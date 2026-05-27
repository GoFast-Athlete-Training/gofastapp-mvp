/**
 * Preset / plan snapshot: easy-day mileage defaults and transitional metadata only.
 *
 * Pace for generated Easy workouts comes from the linked catalogue row's
 * `workPaceOffsetSecPerMile` (fixed sec/mi vs 5K anchor), not from
 * `paceOffsetSecPerMile` here. Do not use this blob as Easy pace truth.
 */

export type EasyRunConfigResolved = {
  standardMiles: number;
  minMiles: number;
  paceOffsetSecPerMile: number;
  weeklyTargetBufferMiles: number;
};

export const EASY_RUN_CONFIG_DEFAULTS: EasyRunConfigResolved = {
  standardMiles: 6,
  minMiles: 4,
  paceOffsetSecPerMile: 90,
  weeklyTargetBufferMiles: 0,
};

function finitePositive(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x <= 0) return fallback;
  return x;
}

function finiteNonNeg(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return fallback;
  return x;
}

/** Offset can be large (e.g. 120 for very easy steady state). */
function finiteOffset(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return x;
}

/**
 * Merge JSON from DB with defaults. Unknown keys ignored.
 */
export function parseEasyRunConfigJson(
  json: unknown | null | undefined
): EasyRunConfigResolved {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    return { ...EASY_RUN_CONFIG_DEFAULTS };
  }
  const o = json as Record<string, unknown>;
  const standardMiles = finitePositive(o.standardMiles, EASY_RUN_CONFIG_DEFAULTS.standardMiles);
  let minMiles = finitePositive(o.minMiles, EASY_RUN_CONFIG_DEFAULTS.minMiles);
  if (minMiles > standardMiles) minMiles = standardMiles;
  return {
    standardMiles,
    minMiles,
    paceOffsetSecPerMile: finiteOffset(
      o.paceOffsetSecPerMile,
      EASY_RUN_CONFIG_DEFAULTS.paceOffsetSecPerMile
    ),
    weeklyTargetBufferMiles: finiteNonNeg(
      o.weeklyTargetBufferMiles,
      EASY_RUN_CONFIG_DEFAULTS.weeklyTargetBufferMiles
    ),
  };
}

/** Persist-only shape (all keys explicit). */
export function easyRunConfigToSnapshot(
  c: EasyRunConfigResolved
): Record<string, number> {
  return {
    standardMiles: c.standardMiles,
    minMiles: c.minMiles,
    paceOffsetSecPerMile: c.paceOffsetSecPerMile,
    weeklyTargetBufferMiles: c.weeklyTargetBufferMiles,
  };
}
