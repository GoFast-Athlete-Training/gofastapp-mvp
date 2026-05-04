/**
 * Update Athlete.aerobicCeilingBpm from qualifying Easy/LongRun average HR.
 * Conservative smoothing: small upward steps; slightly larger downward steps when easy HR is lower.
 */

import { prisma } from "@/lib/prisma";

const MAX_DOWN_ADJUST_BPM = 4;
const MAX_UP_ADJUST_BPM = 2;
/** Ignore upward bumps smaller than this vs stored ceiling (sensor / day noise). */
const UPWARD_NOISE_BAND_BPM = 3;
const MIN_REASONABLE_HR = 80;
const MAX_REASONABLE_HR = 210;

function clampHr(bpm: number): number {
  const r = Math.round(bpm);
  return Math.min(MAX_REASONABLE_HR, Math.max(MIN_REASONABLE_HR, r));
}

/**
 * Pure next value for tests and verification (no DB).
 */
export function computeNextAerobicCeilingBpm(
  previousBpm: number | null,
  creditedBpm: number
): number | null {
  const c = clampHr(creditedBpm);
  if (previousBpm == null) return c;

  const prev = Math.round(previousBpm);
  if (c < prev) {
    return Math.max(c, prev - MAX_DOWN_ADJUST_BPM);
  }
  if (c > prev + UPWARD_NOISE_BAND_BPM) {
    return Math.min(c, prev + MAX_UP_ADJUST_BPM);
  }
  return prev;
}

export type ApplyAerobicCeilingCreditResult = {
  updatedAthleteAerobicCeiling: boolean;
  summary?: string;
};

export async function applyAerobicCeilingCredit(params: {
  athleteId: string;
  creditedAerobicCeilingBpm: number;
  planId: string | null;
  weekNumber: number | null;
  workoutId?: string | null;
}): Promise<ApplyAerobicCeilingCreditResult> {
  const athleteId = params.athleteId;
  const credited = clampHr(params.creditedAerobicCeilingBpm);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { aerobicCeilingBpm: true },
  });

  if (!athlete) {
    return { updatedAthleteAerobicCeiling: false };
  }

  const prev = athlete.aerobicCeilingBpm;
  const next = computeNextAerobicCeilingBpm(prev, credited);

  if (next == null || next === prev) {
    return { updatedAthleteAerobicCeiling: false };
  }

  const summaryMessage =
    prev == null
      ? `Easy/long-run data initialized aerobic ceiling estimate at ~${next} bpm (upper range for easy aerobic work).`
      : `Easy/long-run data adjusted aerobic ceiling estimate to ~${next} bpm.`;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: athleteId },
      data: { aerobicCeilingBpm: next, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId,
        planId: params.planId ?? undefined,
        weekNumber: params.weekNumber ?? undefined,
        workoutId: params.workoutId ?? undefined,
        notificationType: "AEROBIC_CEILING_UPDATE",
        summaryMessage,
      },
    });
  });

  return {
    updatedAthleteAerobicCeiling: true,
    summary: summaryMessage,
  };
}
