import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  loadCompanyCatalogueForIngest,
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
  /** Days with parsed pace-column segments — do not stamp catalogue ids. */
  dateKeysWithParsedSegments?: Set<string>;
}): Promise<EnrichWeekCatalogueResult> {
  const catalogue = params.catalogue ?? (await loadCompanyCatalogueForIngest());
  const byDateKey: Record<string, DayCataloguePreview> = {};
  const summaryNotes: string[] = [];
  const days: PlanDaySchedule[] = [];
  let builderDayCount = 0;
  for (const day of params.week.days) {
    const dateKey = dateKeyForWeekDay(params.planStartDate, params.weekNumber, day.dow);
    const meta = params.metaByDateKey?.[dateKey];
    if (params.dateKeysWithParsedSegments?.has(dateKey)) {
      byDateKey[dateKey] = {
        catalogueWorkoutId: null,
        catalogueName: "From your pace column",
        approximateMatch: false,
        missingCatalogue: false,
      };
      days.push({
        ...day,
        catalogueWorkoutId: null,
        planCycleIndex: null,
      });
      continue;
    }

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

    builderDayCount += 1;
    byDateKey[dateKey] = {
      catalogueWorkoutId: null,
      catalogueName: "Built from schedule",
      approximateMatch: false,
      missingCatalogue: false,
    };
    days.push({
      ...day,
      catalogueWorkoutId: null,
      planCycleIndex: null,
    });
  }

  if (builderDayCount > 0) {
    summaryNotes.push(
      `${builderDayCount} day(s) built from schedule (Work + pace from your 5K), not catalogue closest-match.`,
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
