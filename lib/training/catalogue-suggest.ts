import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";

export type CatalogueWorkoutSummary = {
  id: string;
  slug: string;
  name: string;
  workoutType: WorkoutType;
  trainingIntent: string[];
};

export type CatalogueSuggestResult = {
  conceptSlug: string;
  workoutType: WorkoutType;
  exactMatch: CatalogueWorkoutSummary | null;
  similar: CatalogueWorkoutSummary[];
};

function matchesTrainingIntent(trainingIntent: string[], needle: string): boolean {
  const normalized = needle.toLowerCase();
  return trainingIntent.some((entry) => entry.toLowerCase().includes(normalized));
}

function toSummary(row: {
  id: string;
  slug: string | null;
  name: string;
  workoutType: WorkoutType;
  trainingIntent: string[];
}): CatalogueWorkoutSummary {
  return {
    id: row.id,
    slug: row.slug ?? "",
    name: row.name,
    workoutType: row.workoutType,
    trainingIntent: row.trainingIntent,
  };
}

export async function findCatalogueBySlug(slug: string, workoutType?: WorkoutType) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return prisma.workout_catalogue.findFirst({
    where: {
      slug: normalized,
      ...(workoutType ? { workoutType } : {}),
    },
  });
}

export async function suggestCatalogueWorkouts(opts: {
  conceptSlug: string;
  workoutType: WorkoutType;
  intentSummary?: string | null;
}): Promise<CatalogueSuggestResult> {
  const conceptSlug = normalizeSlug(opts.conceptSlug);
  const exactRow = conceptSlug
    ? await findCatalogueBySlug(conceptSlug, opts.workoutType)
    : null;

  const slugPrefix = conceptSlug ? conceptSlug.slice(0, 8) : "";
  const intentNeedle = opts.intentSummary?.trim() ?? "";

  // trainingIntent is String[] — Prisma has no substring filter on array elements.
  const pool = await prisma.workout_catalogue.findMany({
    where: {
      workoutType: opts.workoutType,
      ...(exactRow ? { id: { not: exactRow.id } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const similarRows = pool
    .filter((row) => {
      const slugHit = slugPrefix.length > 0 && (row.slug?.includes(slugPrefix) ?? false);
      const intentHit =
        intentNeedle.length > 0 && matchesTrainingIntent(row.trainingIntent, intentNeedle);
      if (!slugPrefix && !intentNeedle) return false;
      return slugHit || intentHit;
    })
    .slice(0, 5);

  return {
    conceptSlug,
    workoutType: opts.workoutType,
    exactMatch: exactRow ? toSummary(exactRow) : null,
    similar: similarRows.map(toSummary),
  };
}
