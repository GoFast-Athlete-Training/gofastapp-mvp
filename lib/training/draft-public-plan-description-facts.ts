/**
 * Pure fact builders for public plan description drafting (no DB / OpenAI).
 */

import { isStructuredPlanWeek } from "@/lib/training/plan-schedule-schema";

export type PublicPlanDescriptionFacts = {
  raceName: string | null;
  raceDistanceLabel: string | null;
  goalRaceTime: string | null;
  totalWeeks: number | null;
  athleteFirstName: string | null;
  schedule: {
    weekCount: number;
    qualitySessionsPerWeek: number | null;
    weeksWithLongRun: number;
    distinctCycleSlots: number | null;
  };
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function summarizePlanScheduleForDescription(planSchedule: unknown): PublicPlanDescriptionFacts["schedule"] {
  if (!Array.isArray(planSchedule) || planSchedule.length === 0) {
    return {
      weekCount: 0,
      qualitySessionsPerWeek: null,
      weeksWithLongRun: 0,
      distinctCycleSlots: null,
    };
  }

  const structuredWeeks = planSchedule.filter(isStructuredPlanWeek);
  if (structuredWeeks.length === 0) {
    return {
      weekCount: planSchedule.length,
      qualitySessionsPerWeek: null,
      weeksWithLongRun: 0,
      distinctCycleSlots: null,
    };
  }

  let qualityTotal = 0;
  let weeksWithLongRun = 0;
  const cycleIndices = new Set<number>();

  for (const week of structuredWeeks) {
    let quality = 0;
    let hasLong = false;
    for (const day of week.days) {
      if (day.workoutType === "Tempo" || day.workoutType === "Intervals") quality++;
      if (day.workoutType === "LongRun") hasLong = true;
      if (day.planCycleIndex != null) cycleIndices.add(day.planCycleIndex);
    }
    qualityTotal += quality;
    if (hasLong) weeksWithLongRun++;
  }

  const weekCount = structuredWeeks.length;
  const qualitySessionsPerWeek =
    weekCount > 0 ? Math.round((qualityTotal / weekCount) * 10) / 10 : null;

  return {
    weekCount,
    qualitySessionsPerWeek,
    weeksWithLongRun,
    distinctCycleSlots: cycleIndices.size > 0 ? cycleIndices.size : null,
  };
}

export function buildPublicPlanDescriptionFacts(params: {
  raceName: string | null;
  raceDistanceLabel: string | null;
  goalRaceTime: string | null;
  totalWeeks: number | null;
  athleteFirstName: string | null;
  planSchedule: unknown;
}): PublicPlanDescriptionFacts {
  return {
    raceName: params.raceName,
    raceDistanceLabel: params.raceDistanceLabel,
    goalRaceTime: params.goalRaceTime,
    totalWeeks: params.totalWeeks,
    athleteFirstName: params.athleteFirstName,
    schedule: summarizePlanScheduleForDescription(params.planSchedule),
  };
}

export function buildDeterministicPublicPlanDescriptionFallback(
  facts: PublicPlanDescriptionFacts
): string {
  const raceLabel = [facts.raceName, facts.raceDistanceLabel].filter(Boolean).join(" ");
  const sentences: string[] = [];

  if (raceLabel) {
    sentences.push(`I'm building toward ${raceLabel}.`);
  } else {
    sentences.push("Here's how I'm training this block.");
  }

  if (facts.totalWeeks != null) {
    const goalBit = facts.goalRaceTime ? ` with a ${facts.goalRaceTime} goal` : "";
    sentences.push(`This is a ${facts.totalWeeks}-week plan${goalBit}.`);
  } else if (facts.goalRaceTime) {
    sentences.push(`My target finish is ${facts.goalRaceTime}.`);
  }

  const q = facts.schedule.qualitySessionsPerWeek;
  if (q != null && q >= 1) {
    const rounded = Math.round(q);
    sentences.push(
      `Most weeks include about ${rounded} quality session${rounded === 1 ? "" : "s"} plus a long run.`
    );
  } else if (facts.schedule.weeksWithLongRun > 0) {
    sentences.push("Long runs anchor the week with easy days filling in the rest.");
  }

  return truncate(sentences.slice(0, 4).join(" "), 4000);
}
