import type { WorkoutType } from "@prisma/client";
import {
  isStructuredPlanWeek,
  type PlanWeekSchedule,
} from "@/lib/training/plan-schedule-schema";

export type PublicPlanPreviewSnapshot = {
  planName: string;
  phases: { name: string; startWeek: number; endWeek: number }[];
  sampleWeeks: {
    weekNumber: number;
    days: {
      dow: number;
      workoutType: string;
      miles: number;
      isCustom: boolean;
      title?: string;
    }[];
  }[];
  weeklyMileageRange?: { min: number; max: number } | null;
  raceName?: string | null;
  leaderNotes?: { weekNumber: number; note: string }[];
};

export type PublicPlanCustomWorkoutSnapshot = {
  workouts: {
    sourceId: string;
    weekNumber: number;
    dow: number;
    title: string;
    description: string | null;
    workoutType: string;
    content: unknown;
    leaderNotes: string | null;
  }[];
};

function parsePhases(phases: unknown): PublicPlanPreviewSnapshot["phases"] {
  if (!Array.isArray(phases)) return [];
  return phases
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const o = p as Record<string, unknown>;
      return {
        name: typeof o.name === "string" ? o.name : "Phase",
        startWeek: typeof o.startWeek === "number" ? o.startWeek : 1,
        endWeek: typeof o.endWeek === "number" ? o.endWeek : 1,
      };
    });
}

function buildSampleWeeks(
  planSchedule: unknown,
  customByWeekDay: Map<string, { title: string }>
): PublicPlanPreviewSnapshot["sampleWeeks"] {
  if (!Array.isArray(planSchedule)) return [];
  const weeks = planSchedule.filter(isStructuredPlanWeek) as PlanWeekSchedule[];
  const picks = [1, 2, Math.ceil(weeks.length / 2), weeks.length].filter(
    (n, i, arr) => n >= 1 && n <= weeks.length && arr.indexOf(n) === i
  );
  return picks.map((weekNumber) => {
    const week = weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return { weekNumber, days: [] };
    return {
      weekNumber,
      days: week.days.map((d) => {
        const key = `${weekNumber}-${d.dow}`;
        const custom = customByWeekDay.get(key);
        return {
          dow: d.dow,
          workoutType: d.workoutType,
          miles: d.miles,
          isCustom: !!custom,
          title: custom?.title,
        };
      }),
    };
  });
}

export function buildPreviewSnapshot(params: {
  plan: {
    name: string;
    totalWeeks: number;
    phases: unknown;
    planSchedule: unknown;
    weeklyMileageTarget: number | null;
    currentWeeklyMileage: number | null;
  };
  raceName?: string | null;
  customWorkouts: { weekNumber: number; dow: number; title: string }[];
  leaderNotes?: { weekNumber: number; note: string }[];
}): PublicPlanPreviewSnapshot {
  const customByWeekDay = new Map(
    params.customWorkouts.map((w) => [`${w.weekNumber}-${w.dow}`, w])
  );
  const mileageValues = [
    params.plan.weeklyMileageTarget,
    params.plan.currentWeeklyMileage,
  ].filter((n): n is number => n != null && Number.isFinite(n));
  const weeklyMileageRange =
    mileageValues.length > 0
      ? { min: Math.min(...mileageValues), max: Math.max(...mileageValues) }
      : null;

  return {
    planName: params.plan.name,
    phases: parsePhases(params.plan.phases),
    sampleWeeks: buildSampleWeeks(params.plan.planSchedule, customByWeekDay),
    weeklyMileageRange,
    raceName: params.raceName ?? null,
    leaderNotes: params.leaderNotes ?? [],
  };
}

export function buildCustomWorkoutSnapshot(
  workouts: {
    id: string;
    weekNumber: number;
    dow: number;
    title: string;
    description: string | null;
    workoutType: WorkoutType;
    content: unknown;
    leaderNotes: string | null;
  }[]
): PublicPlanCustomWorkoutSnapshot {
  return {
    workouts: workouts.map((w) => ({
      sourceId: w.id,
      weekNumber: w.weekNumber,
      dow: w.dow,
      title: w.title,
      description: w.description,
      workoutType: w.workoutType,
      content: w.content,
      leaderNotes: w.leaderNotes,
    })),
  };
}
