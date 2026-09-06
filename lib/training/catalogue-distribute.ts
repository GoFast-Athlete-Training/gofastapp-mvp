/**
 * Exclusive catalogue bookend distribution: fractions × day miles, absolute miles, or hybrid.
 * Does not use mpFraction or invented defaults.
 */

import type { workout_catalogue } from "@prisma/client";

export type CatalogueBookendFields = Pick<
  workout_catalogue,
  | "warmupMiles"
  | "cooldownMiles"
  | "workBaseMiles"
  | "warmupFraction"
  | "workFraction"
  | "cooldownFraction"
>;

export type DistributeMode = "fractions" | "miles" | "hybrid" | "none";

export type DistributedBags = {
  warmupMiles: number;
  workMiles: number;
  cooldownMiles: number;
  /** Easy long-run filler when bags do not consume full day miles. */
  easyRemainderMiles: number;
  mode: DistributeMode;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function positiveNumber(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(Number(v))) return 0;
  const n = Number(v);
  return n > 0 ? n : 0;
}

function hasFraction(entry: CatalogueBookendFields): boolean {
  return (
    positiveNumber(entry.warmupFraction) > 0 ||
    positiveNumber(entry.workFraction) > 0 ||
    positiveNumber(entry.cooldownFraction) > 0
  );
}

function hasAbsoluteWarmOrCool(entry: CatalogueBookendFields): boolean {
  return (
    positiveNumber(entry.warmupMiles) > 0 || positiveNumber(entry.cooldownMiles) > 0
  );
}

function hasAbsoluteWork(entry: CatalogueBookendFields): boolean {
  return positiveNumber(entry.workBaseMiles) > 0;
}

/** Detect which bookend language is active on the catalogue row. */
export function detectDistributeMode(entry: CatalogueBookendFields): DistributeMode {
  const frac = hasFraction(entry);
  const absBookends = hasAbsoluteWarmOrCool(entry);
  const absWork = hasAbsoluteWork(entry);

  if (frac && absBookends) return "hybrid";
  if (frac && !absBookends && !absWork) return "fractions";
  if (absBookends || absWork) return "miles";
  return "none";
}

/**
 * Split scheduled day miles into warmup / work / cooldown bags (+ easy remainder).
 * Fractions-only: each fraction × day miles.
 * Miles-only: absolute bookends; work = workBaseMiles or leftover.
 * Hybrid: absolute warmup/cooldown first; work/cooldown fractions split the remainder.
 */
export function distributeCatalogueMiles(
  entry: CatalogueBookendFields,
  dayMiles: number
): DistributedBags {
  const total = Math.max(0, round2(dayMiles));
  const mode = detectDistributeMode(entry);

  if (mode === "none" || total <= 0) {
    return {
      warmupMiles: 0,
      workMiles: 0,
      cooldownMiles: 0,
      easyRemainderMiles: total,
      mode: "none",
    };
  }

  if (mode === "fractions") {
    const wf = positiveNumber(entry.warmupFraction);
    const wkf = positiveNumber(entry.workFraction);
    const cf = positiveNumber(entry.cooldownFraction);
    const warmup = round2(total * wf);
    const work = round2(total * wkf);
    const cooldown = round2(total * cf);
    const spent = round2(warmup + work + cooldown);
    const easyRemainderMiles = round2(Math.max(0, total - spent));
    return { warmupMiles: warmup, workMiles: work, cooldownMiles: cooldown, easyRemainderMiles, mode };
  }

  if (mode === "miles") {
    const warmup = round2(positiveNumber(entry.warmupMiles));
    const cooldown = round2(positiveNumber(entry.cooldownMiles));
    const absWork = positiveNumber(entry.workBaseMiles);
    const work = absWork > 0 ? round2(Math.min(absWork, total)) : round2(Math.max(0, total - warmup - cooldown));
    const spent = round2(warmup + work + cooldown);
    const easyRemainderMiles = round2(Math.max(0, total - spent));
    return { warmupMiles: warmup, workMiles: work, cooldownMiles: cooldown, easyRemainderMiles, mode };
  }

  // hybrid: absolute warmup/cooldown, fractions on remainder
  const absWarmup = round2(positiveNumber(entry.warmupMiles));
  const absCooldown = round2(positiveNumber(entry.cooldownMiles));
  const remainder = round2(Math.max(0, total - absWarmup - absCooldown));
  const wkf = positiveNumber(entry.workFraction);
  const cf = positiveNumber(entry.cooldownFraction);

  let work = 0;
  let cooldown = absCooldown;
  if (wkf > 0 && cf > 0) {
    work = round2(remainder * wkf);
    cooldown = round2(absCooldown + remainder * cf);
  } else if (wkf > 0) {
    work = round2(remainder * wkf);
  } else if (cf > 0) {
    cooldown = round2(absCooldown + remainder * cf);
  }

  const spent = round2(absWarmup + work + cooldown);
  const easyRemainderMiles = round2(Math.max(0, total - spent));

  return {
    warmupMiles: absWarmup,
    workMiles: work,
    cooldownMiles: cooldown,
    easyRemainderMiles,
    mode: "hybrid",
  };
}

/** Work-fraction-only long run: easy miles before goal-pace block at the back. */
export function isCanonicalWorkFractionOnlyLongRun(entry: CatalogueBookendFields): boolean {
  if (!positiveNumber(entry.workFraction)) return false;
  if (positiveNumber(entry.warmupFraction) || positiveNumber(entry.cooldownFraction)) return false;
  if (hasAbsoluteWarmOrCool(entry)) return false;
  return true;
}
