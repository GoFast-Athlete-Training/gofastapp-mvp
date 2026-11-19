import { prisma } from "@/lib/prisma";
import {
  cataloguePrescriptionLine,
  collapsedSegmentTitles,
  type CataloguePrescriptionInput,
} from "@/lib/training/catalogue-prescription-line";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { isStructuredPlanWeek, type PlanDaySchedule } from "@/lib/training/plan-schedule-schema";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type CompanyPlanGodDay = {
  weekNumber: number;
  phase: string | null;
  dow: number;
  dateKey: string;
  scheduled: boolean;
  workoutType: string | null;
  miles: number | null;
  catalogueWorkoutId: string | null;
  plannedWorkoutId: string | null;
  workoutName: string | null;
  steps: string | null;
  prescribed: boolean;
  workoutPushed: boolean;
  workoutEditedAfterPush: boolean;
  garminWorkoutId: number | null;
  garminScheduleId: number | null;
  workoutCompleted: boolean;
};

export type CompanyPlanGodWeek = {
  weekNumber: number;
  phase: string | null;
  days: CompanyPlanGodDay[];
};

const DOW = [1, 2, 3, 4, 5, 6, 7];

function dateKeyFor(planStartDate: Date, weekNumber: number, dow: number): string {
  return utcDateOnly(dateForDayInWeek(planStartDate, weekNumber, dow)).toISOString().slice(0, 10);
}

const catalogueSelect = {
  id: true,
  name: true,
  paceAnchor: true,
  segmentPaceDist: true,
  workBaseReps: true,
  workBaseRepMeters: true,
  workBaseMiles: true,
  workBasePaceOffsetSecPerMile: true,
  workPaceOffsetSecPerMile: true,
  recoveryDistanceMeters: true,
  recoveryDurationSeconds: true,
  recoveryPaceOffsetSecPerMile: true,
} as const;

function narrativeLine(narrative: string | null): string | null {
  const text = narrative?.trim();
  return text ? text.slice(0, 280) : null;
}

export async function loadCompanyPlanGodWeeks(plan: {
  id: string;
  startDate: Date;
  planSchedule: unknown;
}): Promise<CompanyPlanGodWeek[]> {
  if (!Array.isArray(plan.planSchedule)) return [];

  const planned = await prisma.planned_workouts.findMany({
    where: { planId: plan.id },
    select: {
      id: true,
      planDay: true,
      title: true,
      workoutType: true,
      catalogueWorkoutId: true,
      prescriptionNarrative: true,
      estimatedDistanceInMeters: true,
      workoutPushed: true,
      workoutEditedAfterPush: true,
      garminWorkoutId: true,
      garminScheduleId: true,
      workoutCompleted: true,
      segments: { orderBy: { stepOrder: "asc" }, select: { title: true } },
    },
  });

  const catalogueIds = new Set<string>();
  for (const week of plan.planSchedule) {
    if (!isStructuredPlanWeek(week)) continue;
    for (const day of week.days) {
      if (day.catalogueWorkoutId) catalogueIds.add(day.catalogueWorkoutId);
    }
  }
  for (const row of planned) {
    if (row.catalogueWorkoutId) catalogueIds.add(row.catalogueWorkoutId);
  }
  const catalogueById = new Map<string, CataloguePrescriptionInput & { id: string; name: string }>();
  if (catalogueIds.size > 0) {
    const rows = await prisma.workout_catalogue.findMany({
      where: { id: { in: [...catalogueIds] } },
      select: catalogueSelect,
    });
    for (const row of rows) catalogueById.set(row.id, row);
  }

  const plannedByDay = new Map<string, (typeof planned)[number]>();
  for (const row of planned) {
    const key = row.planDay?.slice(0, 10);
    if (key) plannedByDay.set(key, row);
  }

  const weeks: CompanyPlanGodWeek[] = [];
  for (const week of plan.planSchedule) {
    if (!isStructuredPlanWeek(week)) continue;
    const byDow = new Map<number, PlanDaySchedule>();
    for (const day of week.days) byDow.set(day.dow, day);
    const phase = week.phase ?? null;
    const days: CompanyPlanGodDay[] = DOW.map((dow) => {
      const scheduled = byDow.get(dow) ?? null;
      const dateKey = dateKeyFor(plan.startDate, week.weekNumber, dow);
      const row = plannedByDay.get(dateKey) ?? null;
      const catalogueId = row?.catalogueWorkoutId ?? scheduled?.catalogueWorkoutId ?? null;
      const catalogue = catalogueId ? catalogueById.get(catalogueId) ?? null : null;
      const catalogueName = catalogue?.name ?? null;
      const prescription = catalogue ? cataloguePrescriptionLine(catalogue) : null;
      const steps =
        prescription ??
        (row ? collapsedSegmentTitles(row.segments) ?? narrativeLine(row.prescriptionNarrative) : null);
      const prescribed = Boolean(steps || catalogueName);
      const milesFromPlanned =
        row?.estimatedDistanceInMeters != null && row.estimatedDistanceInMeters > 0
          ? Math.round((row.estimatedDistanceInMeters / 1609.34) * 10) / 10
          : null;
      return {
        weekNumber: week.weekNumber,
        phase,
        dow,
        dateKey,
        scheduled: scheduled != null,
        workoutType: row?.workoutType ?? scheduled?.workoutType ?? null,
        miles: milesFromPlanned ?? scheduled?.miles ?? null,
        catalogueWorkoutId: catalogueId,
        plannedWorkoutId: row?.id ?? null,
        workoutName: catalogueName || row?.title || scheduled?.raceName || scheduled?.workoutType || null,
        steps,
        prescribed,
        workoutPushed: row?.workoutPushed ?? false,
        workoutEditedAfterPush: row?.workoutEditedAfterPush ?? false,
        garminWorkoutId: row?.garminWorkoutId ?? null,
        garminScheduleId: row?.garminScheduleId ?? null,
        workoutCompleted: row?.workoutCompleted ?? false,
      };
    });
    weeks.push({ weekNumber: week.weekNumber, phase, days });
  }
  return weeks;
}
