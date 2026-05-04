/**
 * Update Athlete.thresholdPace from matched Tempo completions.
 * Threshold must be slower (higher sec/mi) than 5K — if inferred pace is too fast, flag stale 5K anchor.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

const MAX_ADJUST_SEC_PER_WORKOUT = 12;
/** Minimum cushion: threshold pace must be at least this many sec/mi slower than stored 5K. */
export const MIN_THRESHOLD_ABOVE_FIVEK_SEC = 10;

function secondsPerMileToPaceString(sec: number): string {
  const rounded = Math.max(180, Math.min(720, Math.round(sec)));
  const minutes = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${minutes}:${String(s).padStart(2, "0")}`;
}

export type ApplyThresholdPaceCreditResult = {
  updatedAthleteThreshold: boolean;
  fiveKAnchorStale: boolean;
  summary?: string;
};

export async function applyThresholdPaceCredit(params: {
  athleteId: string;
  creditedThresholdPaceSecPerMile: number;
  planId: string | null;
  weekNumber: number | null;
  workoutId?: string | null;
}): Promise<ApplyThresholdPaceCreditResult> {
  const { athleteId } = params;
  const credited = Math.round(params.creditedThresholdPaceSecPerMile);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true, thresholdPace: true },
  });

  if (!athlete) {
    return { updatedAthleteThreshold: false, fiveKAnchorStale: false };
  }

  let fiveKSec: number | null = null;
  try {
    if (athlete.fiveKPace?.trim()) {
      fiveKSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
    }
  } catch {
    fiveKSec = null;
  }

  if (fiveKSec != null && credited <= fiveKSec + MIN_THRESHOLD_ABOVE_FIVEK_SEC) {
    const staleMsg =
      "Tempo pace is at or barely above your saved 5K pace — threshold cannot be inferred; consider updating your 5K benchmark.";
    await logThresholdNote(params, staleMsg).catch(() => {});
    return {
      updatedAthleteThreshold: false,
      fiveKAnchorStale: true,
      summary: staleMsg,
    };
  }

  let prevThrSec: number | null = null;
  try {
    if (athlete.thresholdPace?.trim()) {
      prevThrSec = parsePaceToSecondsPerMile(athlete.thresholdPace.trim());
    }
  } catch {
    prevThrSec = null;
  }

  let nextSec: number;

  if (prevThrSec == null) {
    nextSec =
      fiveKSec != null ? Math.max(credited, fiveKSec + MIN_THRESHOLD_ABOVE_FIVEK_SEC) : credited;
  } else if (credited < prevThrSec) {
    const delta = prevThrSec - credited;
    const step = Math.min(MAX_ADJUST_SEC_PER_WORKOUT, delta);
    nextSec = Math.max(prevThrSec - step, credited);
    if (fiveKSec != null) {
      nextSec = Math.max(nextSec, fiveKSec + MIN_THRESHOLD_ABOVE_FIVEK_SEC);
    }
  } else if (credited > prevThrSec + 5) {
    const delta = credited - prevThrSec;
    const step = Math.min(Math.floor(MAX_ADJUST_SEC_PER_WORKOUT / 2), delta);
    nextSec = Math.min(prevThrSec + step, credited);
    if (fiveKSec != null) {
      nextSec = Math.max(nextSec, fiveKSec + MIN_THRESHOLD_ABOVE_FIVEK_SEC);
    }
  } else {
    return { updatedAthleteThreshold: false, fiveKAnchorStale: false };
  }

  if (fiveKSec != null && nextSec <= fiveKSec + MIN_THRESHOLD_ABOVE_FIVEK_SEC) {
    return {
      updatedAthleteThreshold: false,
      fiveKAnchorStale: true,
      summary: "Computed threshold collapsed against 5K anchor; skipping update.",
    };
  }

  const newStr = secondsPerMileToPaceString(nextSec);
  const summaryMessage = athlete.thresholdPace?.trim()
    ? `Based on tempo, threshold pace tightened to ~${newStr}/mi (hold capability).`
    : `Based on tempo, threshold pace initialized to ~${newStr}/mi (hold capability).`;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: athleteId },
      data: { thresholdPace: newStr, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId,
        planId: params.planId ?? undefined,
        weekNumber: params.weekNumber ?? undefined,
        workoutId: params.workoutId ?? undefined,
        notificationType: "THRESHOLD_UPDATE",
        summaryMessage,
      },
    });
  });

  return {
    updatedAthleteThreshold: true,
    fiveKAnchorStale: false,
    summary: summaryMessage,
  };
}

async function logThresholdNote(
  params: {
    athleteId: string;
    planId: string | null;
    weekNumber: number | null;
    workoutId?: string | null;
  },
  summaryMessage: string
): Promise<void> {
  await prisma.pace_adjustment_log.create({
    data: {
      athleteId: params.athleteId,
      planId: params.planId ?? undefined,
      weekNumber: params.weekNumber ?? undefined,
      workoutId: params.workoutId ?? undefined,
      notificationType: "THRESHOLD_STALE_5K",
      summaryMessage,
    },
  });
}
