/**
 * Load workout_catalogue.name rows for plan schedule catalogueWorkoutId references.
 */

import { prisma } from "@/lib/prisma";
import {
  collectCatalogueWorkoutIdsFromPlanSchedule,
  collectCatalogueWorkoutIdsForWeekSchedule,
} from "./plan-schedule";

export async function loadCatalogueTitleById(
  catIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(catIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const rows = await prisma.workout_catalogue.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });

  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.id] = r.name;
  }
  return out;
}

export async function loadCatalogueTitleByIdFromPlanSchedule(
  planSchedule: unknown
): Promise<Record<string, string>> {
  return loadCatalogueTitleById(
    collectCatalogueWorkoutIdsFromPlanSchedule(planSchedule)
  );
}

export async function loadCatalogueTitleByIdForWeekSchedule(
  planSchedule: unknown,
  weekNumber: number,
  totalWeeks: number
): Promise<Record<string, string>> {
  return loadCatalogueTitleById(
    collectCatalogueWorkoutIdsForWeekSchedule(planSchedule, weekNumber, totalWeeks)
  );
}
