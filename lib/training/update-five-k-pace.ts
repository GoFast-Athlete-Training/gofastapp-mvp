/**
 * Adjust Athlete.fiveKPace from a workout quality score (0–100), or fixed lap-based adaptive credit.
 * Ported from trainingmvp/lib/services/analysis.ts — conservative identity update.
 */

import { prisma } from "@/lib/prisma";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";

function parsePaceToSeconds(pace: string): number {
  const parts = pace.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  return 480;
}

function secondsToPaceString(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Higher qualityScore → slightly faster predicted 5K (subtract up to 0.8s, cap 10% improvement per call).
 */
export async function updateFiveKPace(
  athleteId: string,
  qualityScore: number
): Promise<string> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
  });

  if (!athlete) {
    throw new Error("Athlete not found");
  }

  const current5k = parsePaceToSeconds(athlete.fiveKPace || "8:00");
  const improvement = (qualityScore / 100) * 0.8;
  const new5kSeconds = Math.max(current5k - improvement, current5k * 0.9);
  const new5kTime = secondsToPaceString(new5kSeconds);

  await prisma.athlete.update({
    where: { id: athleteId },
    data: { fiveKPace: new5kTime },
  });

  await syncAthleteFiveKPaceToActivePlan(athleteId);

  return new5kTime;
}

export function qualityScoreFromPaceDelta(deltaSecPerMile: number | null): number {
  if (deltaSecPerMile == null) return 55;
  const clamped = Math.max(-60, Math.min(60, deltaSecPerMile));
  return Math.round(55 + (clamped / 60) * 35);
}
