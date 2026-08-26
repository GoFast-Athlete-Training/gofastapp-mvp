/**
 * Athlete preset rotations — shared Long Run/Easy configs with ordering overlays;
 * athlete-owned Tempo/Interval configs with selectable catalogue workouts.
 */

import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";
import { reorderPositionRows } from "@/lib/training/reorder-position-rows";
import { trainingPlanPresetInclude } from "@/lib/training/plan-generate-presets-loader";

import { QUALITY_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";

type ConfigPositionRow = {
  id: string;
  cyclePosition: number;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
};

function mapByCatalogue(
  positions: ConfigPositionRow[]
): Map<string, ConfigPositionRow> {
  const m = new Map<string, ConfigPositionRow>();
  for (const p of positions) {
    if (p.catalogueWorkoutId) m.set(p.catalogueWorkoutId, p);
  }
  return m;
}

function defaultWeight(count: number, index: number): number {
  if (count <= 0) return 0.125;
  const base = Math.round((1 / count) * 1000) / 1000;
  return index === count - 1 ? Math.round((1 - base * (count - 1)) * 1000) / 1000 : base;
}

async function seedLongRunOrder(params: {
  athletePresetId: string;
  sourcePositionIds: string[];
}): Promise<void> {
  const existing = await prisma.athlete_preset_long_run_order.count({
    where: { athletePresetId: params.athletePresetId },
  });
  if (existing > 0) return;

  const now = new Date();
  await prisma.athlete_preset_long_run_order.createMany({
    data: params.sourcePositionIds.map((longRunConfigPositionId, idx) => ({
      id: newEntityId(),
      athletePresetId: params.athletePresetId,
      longRunConfigPositionId,
      cyclePosition: idx + 1,
      updatedAt: now,
    })),
  });
}

async function seedEasyOrder(params: {
  athletePresetId: string;
  sourcePositionIds: string[];
}): Promise<void> {
  const existing = await prisma.athlete_preset_easy_order.count({
    where: { athletePresetId: params.athletePresetId },
  });
  if (existing > 0) return;

  const now = new Date();
  await prisma.athlete_preset_easy_order.createMany({
    data: params.sourcePositionIds.map((easyConfigPositionId, idx) => ({
      id: newEntityId(),
      athletePresetId: params.athletePresetId,
      easyConfigPositionId,
      cyclePosition: idx + 1,
      updatedAt: now,
    })),
  });
}

async function remapCloneOrderToSource(params: {
  athletePresetId: string;
  clonePositions: ConfigPositionRow[];
  sourcePositions: ConfigPositionRow[];
  kind: "longRun" | "easy";
}): Promise<void> {
  const sourceByCatalogue = mapByCatalogue(params.sourcePositions);
  const orderedSourceIds: string[] = [];
  for (const p of [...params.clonePositions].sort(
    (a, b) => a.cyclePosition - b.cyclePosition
  )) {
    const match =
      (p.catalogueWorkoutId && sourceByCatalogue.get(p.catalogueWorkoutId)) ??
      params.sourcePositions.find((s) => s.cyclePosition === p.cyclePosition);
    if (match) orderedSourceIds.push(match.id);
  }
  const unique = [...new Set(orderedSourceIds)];
  if (unique.length !== params.sourcePositions.length) {
    throw new Error("Could not map cloned rotation to source template");
  }

  if (params.kind === "longRun") {
    await prisma.athlete_preset_long_run_order.deleteMany({
      where: { athletePresetId: params.athletePresetId },
    });
    await seedLongRunOrder({
      athletePresetId: params.athletePresetId,
      sourcePositionIds: unique,
    });
    return;
  }

  await prisma.athlete_preset_easy_order.deleteMany({
    where: { athletePresetId: params.athletePresetId },
  });
  await seedEasyOrder({
    athletePresetId: params.athletePresetId,
    sourcePositionIds: unique,
  });
}

async function ensureAthleteQualityConfig(params: {
  athletePresetId: string;
  kind: "tempo" | "intervals";
  seedCatalogueIds: string[];
}): Promise<void> {
  const slots = QUALITY_ROTATION_SLOTS;
  const catalogueIds = params.seedCatalogueIds.slice(0, slots);
  while (catalogueIds.length < slots) {
    catalogueIds.push(catalogueIds[catalogueIds.length - 1] ?? catalogueIds[0] ?? "");
  }

  if (params.kind === "tempo") {
    let config = await prisma.athlete_tempo_config.findUnique({
      where: { athletePresetId: params.athletePresetId },
      include: { positions: true },
    });
    if (!config) {
      const now = new Date();
      const configId = newEntityId();
      await prisma.athlete_tempo_config.create({
        data: {
          id: configId,
          athletePresetId: params.athletePresetId,
          updatedAt: now,
          positions: {
            create: catalogueIds.map((catalogueWorkoutId, idx) => ({
              id: newEntityId(),
              cyclePosition: idx + 1,
              distributionWeight: defaultWeight(slots, idx),
              catalogueWorkoutId: catalogueWorkoutId || null,
              updatedAt: now,
            })),
          },
        },
      });
    }
    return;
  }

  let config = await prisma.athlete_intervals_config.findUnique({
    where: { athletePresetId: params.athletePresetId },
    include: { positions: true },
  });
  if (!config) {
    const now = new Date();
    const configId = newEntityId();
    await prisma.athlete_intervals_config.create({
      data: {
        id: configId,
        athletePresetId: params.athletePresetId,
        updatedAt: now,
        positions: {
          create: catalogueIds.map((catalogueWorkoutId, idx) => ({
            id: newEntityId(),
            cyclePosition: idx + 1,
            distributionWeight: defaultWeight(slots, idx),
            catalogueWorkoutId: catalogueWorkoutId || null,
            updatedAt: now,
          })),
        },
      },
    });
  }
}

function catalogueIdsFromPositions(positions: ConfigPositionRow[]): string[] {
  return positions
    .slice()
    .sort((a, b) => a.cyclePosition - b.cyclePosition)
    .map((p) => p.catalogueWorkoutId)
    .filter((id): id is string => Boolean(id));
}

/** Idempotent: link shared LR/Easy configs, seed overlays, seed athlete quality configs. */
export async function setupAthleteRotationsFromSource(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<void> {
  const [athlete, source] = await Promise.all([
    prisma.athlete_presets.findUnique({
      where: { id: params.athletePresetId },
      include: {
        longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        easyConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        intervalsConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        tempoConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      },
    }),
    prisma.training_plan_preset.findUnique({
      where: { id: params.sourcePresetId },
      include: trainingPlanPresetInclude,
    }),
  ]);

  if (!athlete || !source) {
    throw new Error("Athlete preset or source template not found");
  }
  if (!source.longRunConfigId || !source.easyConfigId) {
    throw new Error("Source preset is missing long-run or easy rotation configs");
  }

  const sourceLrPositions = source.longRunConfig?.positions ?? [];
  const sourceEasyPositions = source.easyConfig?.positions ?? [];

  const lrIsClone =
    athlete.longRunConfigId != null &&
    athlete.longRunConfigId !== source.longRunConfigId;
  const easyIsClone =
    athlete.easyConfigId != null && athlete.easyConfigId !== source.easyConfigId;

  if (lrIsClone && athlete.longRunConfig?.positions?.length) {
    await remapCloneOrderToSource({
      athletePresetId: params.athletePresetId,
      clonePositions: athlete.longRunConfig.positions,
      sourcePositions: sourceLrPositions,
      kind: "longRun",
    });
  } else {
    await seedLongRunOrder({
      athletePresetId: params.athletePresetId,
      sourcePositionIds: sourceLrPositions.map((p) => p.id),
    });
  }

  if (easyIsClone && athlete.easyConfig?.positions?.length) {
    await remapCloneOrderToSource({
      athletePresetId: params.athletePresetId,
      clonePositions: athlete.easyConfig.positions,
      sourcePositions: sourceEasyPositions,
      kind: "easy",
    });
  } else {
    await seedEasyOrder({
      athletePresetId: params.athletePresetId,
      sourcePositionIds: sourceEasyPositions.map((p) => p.id),
    });
  }

  const tempoSeed =
    athlete.tempoConfig?.positions?.length
      ? catalogueIdsFromPositions(athlete.tempoConfig.positions)
      : catalogueIdsFromPositions(source.tempoConfig?.positions ?? []);
  const intervalSeed =
    athlete.intervalsConfig?.positions?.length
      ? catalogueIdsFromPositions(athlete.intervalsConfig.positions)
      : catalogueIdsFromPositions(source.intervalsConfig?.positions ?? []);

  await ensureAthleteQualityConfig({
    athletePresetId: params.athletePresetId,
    kind: "tempo",
    seedCatalogueIds: tempoSeed,
  });
  await ensureAthleteQualityConfig({
    athletePresetId: params.athletePresetId,
    kind: "intervals",
    seedCatalogueIds: intervalSeed,
  });

  await prisma.athlete_presets.update({
    where: { id: params.athletePresetId },
    data: {
      longRunConfigId: source.longRunConfigId,
      easyConfigId: source.easyConfigId,
      intervalsConfigId: null,
      tempoConfigId: null,
      updatedAt: new Date(),
    },
  });
}

export async function reorderAthleteLongRunOrder(params: {
  athletePresetId: string;
  orderedPositionIds: string[];
}): Promise<void> {
  const rows = await prisma.athlete_preset_long_run_order.findMany({
    where: { athletePresetId: params.athletePresetId },
    orderBy: { cyclePosition: "asc" },
  });
  if (rows.length === 0) {
    throw new Error("No long-run order rows to reorder");
  }

  const positionIdSet = new Set(rows.map((r) => r.longRunConfigPositionId));
  if (params.orderedPositionIds.length !== rows.length) {
    throw new Error("Reorder must include every position exactly once");
  }
  for (const id of params.orderedPositionIds) {
    if (!positionIdSet.has(id)) {
      throw new Error("Invalid long-run position id in reorder");
    }
  }

  const byPositionId = new Map(rows.map((r) => [r.longRunConfigPositionId, r]));
  const orderedRowIds = params.orderedPositionIds.map(
    (pid) => byPositionId.get(pid)!.id
  );

  await prisma.$transaction(async (tx) => {
    await reorderPositionRows({
      rows,
      orderedIds: orderedRowIds,
      tempOffset: 100,
      update: async (id, cyclePosition) => {
        await tx.athlete_preset_long_run_order.update({
          where: { id },
          data: { cyclePosition, updatedAt: new Date() },
        });
      },
    });
  });
}

export async function reorderAthleteEasyOrder(params: {
  athletePresetId: string;
  orderedPositionIds: string[];
}): Promise<void> {
  const rows = await prisma.athlete_preset_easy_order.findMany({
    where: { athletePresetId: params.athletePresetId },
    orderBy: { cyclePosition: "asc" },
  });
  if (rows.length === 0) {
    throw new Error("No easy order rows to reorder");
  }

  const positionIdSet = new Set(rows.map((r) => r.easyConfigPositionId));
  if (params.orderedPositionIds.length !== rows.length) {
    throw new Error("Reorder must include every position exactly once");
  }
  for (const id of params.orderedPositionIds) {
    if (!positionIdSet.has(id)) {
      throw new Error("Invalid easy position id in reorder");
    }
  }

  const byPositionId = new Map(rows.map((r) => [r.easyConfigPositionId, r]));
  const orderedRowIds = params.orderedPositionIds.map(
    (pid) => byPositionId.get(pid)!.id
  );

  await prisma.$transaction(async (tx) => {
    await reorderPositionRows({
      rows,
      orderedIds: orderedRowIds,
      tempOffset: 100,
      update: async (id, cyclePosition) => {
        await tx.athlete_preset_easy_order.update({
          where: { id },
          data: { cyclePosition, updatedAt: new Date() },
        });
      },
    });
  });
}

function validateQualitySelection(catalogueWorkoutIds: string[]): void {
  if (catalogueWorkoutIds.length !== QUALITY_ROTATION_SLOTS) {
    throw new Error(`Exactly ${QUALITY_ROTATION_SLOTS} workouts required`);
  }
  const unique = new Set(catalogueWorkoutIds);
  if (unique.size !== catalogueWorkoutIds.length) {
    throw new Error("Duplicate catalogue workouts are not allowed");
  }
  if (catalogueWorkoutIds.some((id) => !id.trim())) {
    throw new Error("Every slot must have a catalogue workout");
  }
}

export async function saveAthleteTempoSelection(params: {
  athletePresetId: string;
  orderedCatalogueWorkoutIds: string[];
}): Promise<void> {
  validateQualitySelection(params.orderedCatalogueWorkoutIds);

  const config = await prisma.athlete_tempo_config.findUnique({
    where: { athletePresetId: params.athletePresetId },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });
  if (!config) {
    throw new Error("Athlete tempo config missing — run setup first");
  }

  const now = new Date();
  const slots = QUALITY_ROTATION_SLOTS;
  await prisma.$transaction(async (tx) => {
    await tx.athlete_tempo_config_position.deleteMany({
      where: { athleteTempoConfigId: config.id },
    });
    await tx.athlete_tempo_config_position.createMany({
      data: params.orderedCatalogueWorkoutIds.map((catalogueWorkoutId, idx) => ({
        id: newEntityId(),
        athleteTempoConfigId: config.id,
        cyclePosition: idx + 1,
        distributionWeight: defaultWeight(slots, idx),
        catalogueWorkoutId,
        updatedAt: now,
      })),
    });
    await tx.athlete_tempo_config.update({
      where: { id: config.id },
      data: { updatedAt: now },
    });
  });
}

export async function saveAthleteIntervalsSelection(params: {
  athletePresetId: string;
  orderedCatalogueWorkoutIds: string[];
}): Promise<void> {
  validateQualitySelection(params.orderedCatalogueWorkoutIds);

  const config = await prisma.athlete_intervals_config.findUnique({
    where: { athletePresetId: params.athletePresetId },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });
  if (!config) {
    throw new Error("Athlete intervals config missing — run setup first");
  }

  const now = new Date();
  const slots = QUALITY_ROTATION_SLOTS;
  await prisma.$transaction(async (tx) => {
    await tx.athlete_intervals_config_position.deleteMany({
      where: { athleteIntervalsConfigId: config.id },
    });
    await tx.athlete_intervals_config_position.createMany({
      data: params.orderedCatalogueWorkoutIds.map((catalogueWorkoutId, idx) => ({
        id: newEntityId(),
        athleteIntervalsConfigId: config.id,
        cyclePosition: idx + 1,
        distributionWeight: defaultWeight(slots, idx),
        catalogueWorkoutId,
        updatedAt: now,
      })),
    });
    await tx.athlete_intervals_config.update({
      where: { id: config.id },
      data: { updatedAt: now },
    });
  });
}

export async function reorderAthleteQualityPositions(params: {
  athletePresetId: string;
  kind: "tempo" | "intervals";
  orderedCatalogueWorkoutIds: string[];
}): Promise<void> {
  validateQualitySelection(params.orderedCatalogueWorkoutIds);
  if (params.kind === "tempo") {
    await saveAthleteTempoSelection({
      athletePresetId: params.athletePresetId,
      orderedCatalogueWorkoutIds: params.orderedCatalogueWorkoutIds,
    });
    return;
  }
  await saveAthleteIntervalsSelection({
    athletePresetId: params.athletePresetId,
    orderedCatalogueWorkoutIds: params.orderedCatalogueWorkoutIds,
  });
}
