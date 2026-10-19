/**
 * Pick the closest existing workout catalogue row for ingest (no invented workouts).
 */

import type { WorkoutType } from "@prisma/client";
import {
  estimateCatalogueWorkoutMiles,
  type CatalogueMileEstimateInput,
} from "@/lib/training/catalogue-mile-estimate";

export type IngestCataloguePick = CatalogueMileEstimateInput & {
  id: string;
  name: string;
  slug: string | null;
};

export type CatalogueMatchResult = {
  catalogueWorkoutId: string | null;
  catalogueName: string | null;
  approximateMatch: boolean;
};

function catalogueTotalMiles(row: IngestCataloguePick, workoutType: WorkoutType): number {
  const wt =
    workoutType === "LongRun"
      ? "Easy"
      : workoutType === "Race"
        ? "Easy"
        : workoutType;
  if (wt !== "Easy" && wt !== "Tempo" && wt !== "Intervals") {
    return estimateCatalogueWorkoutMiles(row, "Easy");
  }
  return estimateCatalogueWorkoutMiles(row, wt);
}

function hintSuggestsStructuredWork(hint: string): boolean {
  const h = hint.toLowerCase();
  const hasDistance = /\b\d+(?:\.\d+)?\s*miles?\b/.test(h);
  return (
    hasDistance &&
    (/\beasy\b/.test(h) || /\bhard\b/.test(h) || /\btempo\b/.test(h) || /\bwarm/.test(h))
  );
}

function rowHasStructuredWork(row: IngestCataloguePick): boolean {
  const wu = Number(row.warmupMiles);
  const cd = Number(row.cooldownMiles);
  if (Number.isFinite(wu) && wu > 0 && Number.isFinite(cd) && cd > 0) return true;
  if (Array.isArray(row.segmentPaceDist) && row.segmentPaceDist.length > 0) return true;
  return false;
}

export function pickClosestCatalogueEntry(params: {
  workoutType: WorkoutType;
  miles: number;
  hintText?: string;
  catalogue: IngestCataloguePick[];
}): CatalogueMatchResult {
  const hint = (params.hintText ?? "").trim();
  const candidates = params.catalogue.filter((c) => c.workoutType === params.workoutType);
  if (candidates.length === 0) {
    return { catalogueWorkoutId: null, catalogueName: null, approximateMatch: false };
  }

  const targetMi = params.miles;
  const structuredHint = hintSuggestsStructuredWork(hint);

  let best: IngestCataloguePick | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const row of candidates) {
    const est = catalogueTotalMiles(row, params.workoutType);
    let score = Math.abs(est - targetMi);
    if (structuredHint && !rowHasStructuredWork(row)) score += 4;
    if (structuredHint && rowHasStructuredWork(row)) score -= 1;
    if (hint && row.name && hint.toLowerCase().includes(row.name.toLowerCase().slice(0, 12))) {
      score -= 2;
    }
    if (score < bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best) {
    return { catalogueWorkoutId: null, catalogueName: null, approximateMatch: false };
  }

  const approximateMatch = bestScore > 1.5 || structuredHint;
  return {
    catalogueWorkoutId: best.id,
    catalogueName: best.name,
    approximateMatch,
  };
}

export async function loadCompanyCatalogueForIngest(): Promise<IngestCataloguePick[]> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.workout_catalogue.findMany({
    where: { ownerAthleteId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      workoutType: true,
      segmentPaceDist: true,
      warmupMiles: true,
      cooldownMiles: true,
      workBaseMiles: true,
      workBaseReps: true,
      workBaseRepMeters: true,
    },
    orderBy: [{ workoutType: "asc" }, { name: "asc" }],
  });
}
