/**
 * Per-workout 5K pace credit after a matched quality run (Tempo/Intervals) with paceDelta >= 0.
 * Writes pace_adjustment_log for in-app notification when the profile pace actually moves.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";

const MAX_ADJUST_SEC = 10;

function secondsPerMileToPaceString(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${minutes}:${s.toString().padStart(2, "0")}`;
}

export async function applyWorkoutPaceCredit(params: {
  athleteId: string;
  creditedFiveKPaceSecPerMile: number;
  planId: string | null;
  weekNumber: number | null;
}): Promise<void> {
  const { athleteId, creditedFiveKPaceSecPerMile: credited } = params;

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete?.fiveKPace?.trim()) return;

  const previousSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());

  if (credited >= previousSec) {
    return;
  }

  const adjustSec = Math.min(MAX_ADJUST_SEC, previousSec - credited);
  const newSec = Math.max(
    previousSec - adjustSec,
    Math.floor(previousSec * 0.9)
  );
  if (newSec >= previousSec) return;

  const newPaceStr = secondsPerMileToPaceString(newSec);
  const summaryMessage = `Based on this workout, your 5K pace is now ${newPaceStr}/mi.`;

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: athleteId },
      data: { fiveKPace: newPaceStr, updatedAt: new Date() },
    });
    await tx.pace_adjustment_log.create({
      data: {
        athleteId,
        planId: params.planId ?? undefined,
        weekNumber: params.weekNumber ?? undefined,
        previousPaceSecPerMile: previousSec,
        newPaceSecPerMile: newSec,
        adjustmentSecPerMile: previousSec - newSec,
        qualityWorkoutsCount: 1,
        qualityAvgDeltaSecPerMile: null,
        longRunCompleted: false,
        longRunCompletionRatio: null,
        weeklyMileageCompletionPct: null,
        summaryMessage,
      },
    });
  });

  await syncAthleteFiveKPaceToActivePlan(athleteId);
}
