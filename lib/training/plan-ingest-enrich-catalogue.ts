import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  loadCompanyCatalogueForIngest,
  pickClosestCatalogueEntry,
  type IngestCataloguePick,
} from "@/lib/training/plan-ingest-catalogue-match";
import { dateKeyForWeekDay } from "@/lib/training/plan-week-ingest-guard";

export type DayCataloguePreview = {
  catalogueWorkoutId: string | null;
  catalogueName: string | null;
  approximateMatch: boolean;
  missingCatalogue: boolean;
};

export type EnrichWeekCatalogueResult = {
  week: PlanWeekSchedule;
  byDateKey: Record<string, DayCataloguePreview>;
  summaryNotes: string[];
};

export async function enrichWeekDaysWithCatalogue(params: {
  week: PlanWeekSchedule;
  weekNumber: number;
  planStartDate: Date;
  metaByDateKey?: Record<string, { workoutName?: string; paceNote?: string }>;
  catalogue?: IngestCataloguePick[];
}): Promise<EnrichWeekCatalogueResult> {
  const catalogue = params.catalogue ?? (await loadCompanyCatalogueForIngest());
  const byDateKey: Record<string, DayCataloguePreview> = {};
  const summaryNotes: string[] = [];
  let approximateCount = 0;
  let missingCount = 0;

  const days: PlanDaySchedule[] = [];
  for (const day of params.week.days) {
    const dateKey = dateKeyForWeekDay(params.planStartDate, params.weekNumber, day.dow);
    const meta = params.metaByDateKey?.[dateKey];
    const hint = [meta?.workoutName, meta?.paceNote].filter(Boolean).join(" · ");

    if (day.catalogueWorkoutId) {
      const row = catalogue.find((c) => c.id === day.catalogueWorkoutId);
      byDateKey[dateKey] = {
        catalogueWorkoutId: day.catalogueWorkoutId,
        catalogueName: row?.name ?? null,
        approximateMatch: false,
        missingCatalogue: false,
      };
      days.push(day);
      continue;
    }

    const match = pickClosestCatalogueEntry({
      workoutType: day.workoutType,
      miles: day.miles,
      hintText: hint,
      catalogue,
    });

    if (!match.catalogueWorkoutId) {
      missingCount += 1;
      byDateKey[dateKey] = {
        catalogueWorkoutId: null,
        catalogueName: null,
        approximateMatch: false,
        missingCatalogue: true,
      };
      days.push(day);
      continue;
    }

    if (match.approximateMatch) approximateCount += 1;
    byDateKey[dateKey] = {
      catalogueWorkoutId: match.catalogueWorkoutId,
      catalogueName: match.catalogueName,
      approximateMatch: match.approximateMatch,
      missingCatalogue: false,
    };
    days.push({
      ...day,
      catalogueWorkoutId: match.catalogueWorkoutId,
    });
  }

  if (approximateCount > 0) {
    summaryNotes.push(
      `${approximateCount} day(s) use the closest catalogue match — pace structure may not be exact.`,
    );
  }
  if (missingCount > 0) {
    summaryNotes.push(
      `${missingCount} day(s) have no catalogue match. If you do not see the right workout, tell staff and we will build it.`,
    );
  }

  return {
    week: { ...params.week, days },
    byDateKey,
    summaryNotes,
  };
}

export function catalogueListForOpenAiPrompt(catalogue: IngestCataloguePick[]): unknown[] {
  return catalogue.map((c) => ({
    id: c.id,
    name: c.name,
    workoutType: c.workoutType,
    slug: c.slug,
  }));
}
