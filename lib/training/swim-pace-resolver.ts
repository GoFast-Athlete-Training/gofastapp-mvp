/**
 * Swim pace resolution from athlete FourHunMSwPace (seconds per 100m).
 * UI may send total 400m time — normalize before persist.
 */

import type { SwimWorkoutType } from "@prisma/client";
import type { SwimWorkoutTypeKey } from "@/lib/training/swim-plan-preset";

export type SwimPaceOffsetRange = {
  low: number;
  high: number;
};

/**
 * Placeholder offsets from FourHunMSwPace (sec/100m).
 * TODO(phase-2): finalize coefficients from coach review + completion data.
 */
export const SWIM_PACE_OFFSETS_BY_TYPE: Record<SwimWorkoutTypeKey, SwimPaceOffsetRange> = {
  EnduranceSwim: { low: 6, high: 15 },
  ThresholdSwim: { low: 0, high: 2 },
  PowerSwim: { low: -10, high: -4 },
  LongSwim: { low: 8, high: 18 },
};

export type SwimPaceProfileEntry = {
  offsetSecPer100mLow: number;
  offsetSecPer100mHigh: number;
};

export type SwimPaceProfile = Partial<
  Record<SwimWorkoutTypeKey | string, SwimPaceProfileEntry>
>;

export type ResolvedSwimPaceTargets = {
  paceSecPer100mLow: number;
  paceSecPer100mHigh: number;
  paceNote: string;
};

/**
 * Convert total 400m benchmark time to seconds-per-100m pace for storage on Athlete.FourHunMSwPace.
 */
export function normalizeFourHunMSwPaceFrom400m(total400mSeconds: number): number {
  if (!Number.isFinite(total400mSeconds) || total400mSeconds <= 0) {
    throw new Error("total400mSeconds must be a positive number");
  }
  return Math.round(total400mSeconds / 4);
}

export function formatSwimPaceNote(secPer100m: number): string {
  const sec = Math.max(0, Math.round(secPer100m));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}/100m`;
}

export function resolveSwimPaceTargets(params: {
  fourHunMSwPace: number;
  workoutType: SwimWorkoutType;
  paceProfile?: SwimPaceProfile | null;
  catalogueOffsetSecPer100m?: number | null;
}): ResolvedSwimPaceTargets {
  const anchor = Math.round(params.fourHunMSwPace);
  if (!Number.isFinite(anchor) || anchor <= 0) {
    throw new Error("fourHunMSwPace must be a positive number (seconds per 100m)");
  }

  const profileEntry = params.paceProfile?.[params.workoutType];
  let lowOffset: number;
  let highOffset: number;

  if (profileEntry) {
    lowOffset = profileEntry.offsetSecPer100mLow;
    highOffset = profileEntry.offsetSecPer100mHigh;
  } else if (params.catalogueOffsetSecPer100m != null) {
    lowOffset = params.catalogueOffsetSecPer100m;
    highOffset = params.catalogueOffsetSecPer100m;
  } else {
    const defaults =
      SWIM_PACE_OFFSETS_BY_TYPE[params.workoutType as SwimWorkoutTypeKey];
    lowOffset = defaults?.low ?? 0;
    highOffset = defaults?.high ?? 0;
  }

  const paceSecPer100mLow = anchor + Math.min(lowOffset, highOffset);
  const paceSecPer100mHigh = anchor + Math.max(lowOffset, highOffset);
  const mid = Math.round((paceSecPer100mLow + paceSecPer100mHigh) / 2);

  return {
    paceSecPer100mLow,
    paceSecPer100mHigh,
    paceNote: `${formatSwimPaceNote(paceSecPer100mLow)}–${formatSwimPaceNote(paceSecPer100mHigh)} (anchor ${formatSwimPaceNote(anchor)})`,
  };
}

// TODO(phase-2): calibrate offsets per persona capability and pool vs open water.
