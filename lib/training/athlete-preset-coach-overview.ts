import type { Prisma } from "@prisma/client";
import type { CoreVolumeCalendarPreview } from "@/lib/training/core-volume-compute";

export function mergeCoachPlanOverview(
  existing: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

export function coachOverviewFromCoreInfer(input: {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: string;
  weeklyVolumeBand?: string;
  minWeeklyMiles?: number;
  maxWeeklyMiles?: number | null;
  calendar: CoreVolumeCalendarPreview;
  cupsConfirmed?: boolean;
}): Record<string, unknown> {
  return {
    cupsConfirmed: input.cupsConfirmed ?? true,
    weSeeYou: input.weSeeYou,
    barriers: input.barriers,
    progressionAggressiveness: input.progressionAggressiveness,
    weeklyVolumeBand: input.weeklyVolumeBand ?? null,
    minWeeklyMiles: input.minWeeklyMiles ?? null,
    maxWeeklyMiles: input.maxWeeklyMiles ?? null,
    peakPoolKey: input.calendar.peakPoolKey,
    peakLongRunDate: input.calendar.peakLongRunDate,
    taperStartDate: input.calendar.taperStartDate,
    poolMilesByCycle: input.calendar.poolMilesByCycle,
    totalWeeks: input.calendar.totalWeeks,
  };
}
