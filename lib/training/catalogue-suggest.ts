import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";

export type CatalogueWorkoutSummary = {
  id: string;
  slug: string;
  name: string;
  workoutType: WorkoutType;
  trainingIntent: string | null;
};

export type CatalogueSuggestResult = {
  conceptSlug: string;
  workoutType: WorkoutType;
  exactMatch: CatalogueWorkoutSummary | null;
  similar: CatalogueWorkoutSummary[];
};

function toSummary(row: {
  id: string;
  slug: string | null;
  name: string;
  workoutType: WorkoutType;
  trainingIntent: string | null;
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

  const similarRows = await prisma.workout_catalogue.findMany({
    where: {
      workoutType: opts.workoutType,
      ...(exactRow ? { id: { not: exactRow.id } } : {}),
      OR: [
        ...(conceptSlug ? [{ slug: { contains: conceptSlug.slice(0, 8) } }] : []),
        ...(opts.intentSummary?.trim()
          ? [{ trainingIntent: { contains: opts.intentSummary.trim(), mode: "insensitive" as const } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return {
    conceptSlug,
    workoutType: opts.workoutType,
    exactMatch: exactRow ? toSummary(exactRow) : null,
    similar: similarRows.map(toSummary),
  };
}
