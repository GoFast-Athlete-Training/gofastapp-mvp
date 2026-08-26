/**
 * Deep-clone rotation configs from a staff catalog preset onto athlete-owned config rows.
 */

import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";
import { trainingPlanPresetInclude } from "@/lib/training/plan-generate-presets-loader";

type ConfigKind = "longRun" | "intervals" | "tempo" | "easy";

async function cloneConfig(
  kind: ConfigKind,
  sourceConfigId: string | null | undefined,
  nameSuffix: string
): Promise<string | null> {
  if (!sourceConfigId) return null;

  const now = new Date();
  const id = newEntityId();

  if (kind === "longRun") {
    const src = await prisma.long_run_config.findUnique({
      where: { id: sourceConfigId },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
    if (!src) return null;
    await prisma.long_run_config.create({
      data: {
        id,
        name: `${src.name}${nameSuffix}`,
        description: src.description,
        updatedAt: now,
      },
    });
    for (const p of src.positions) {
      await prisma.long_run_config_position.create({
        data: {
          id: newEntityId(),
          longRunConfigId: id,
          cyclePosition: p.cyclePosition,
          distributionWeight: p.distributionWeight,
          catalogueWorkoutId: p.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  if (kind === "intervals") {
    const src = await prisma.intervals_config.findUnique({
      where: { id: sourceConfigId },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
    if (!src) return null;
    await prisma.intervals_config.create({
      data: {
        id,
        name: `${src.name}${nameSuffix}`,
        description: src.description,
        updatedAt: now,
      },
    });
    for (const p of src.positions) {
      await prisma.intervals_config_position.create({
        data: {
          id: newEntityId(),
          intervalsConfigId: id,
          cyclePosition: p.cyclePosition,
          distributionWeight: p.distributionWeight,
          catalogueWorkoutId: p.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  if (kind === "tempo") {
    const src = await prisma.tempo_config.findUnique({
      where: { id: sourceConfigId },
      include: { positions: { orderBy: { cyclePosition: "asc" } } },
    });
    if (!src) return null;
    await prisma.tempo_config.create({
      data: {
        id,
        name: `${src.name}${nameSuffix}`,
        description: src.description,
        updatedAt: now,
      },
    });
    for (const p of src.positions) {
      await prisma.tempo_config_position.create({
        data: {
          id: newEntityId(),
          tempoConfigId: id,
          cyclePosition: p.cyclePosition,
          distributionWeight: p.distributionWeight,
          catalogueWorkoutId: p.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  const src = await prisma.easy_config.findUnique({
    where: { id: sourceConfigId },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });
  if (!src) return null;
  await prisma.easy_config.create({
    data: {
      id,
      name: `${src.name}${nameSuffix}`,
      description: src.description,
      updatedAt: now,
    },
  });
  for (const p of src.positions) {
    await prisma.easy_config_position.create({
      data: {
        id: newEntityId(),
        easyConfigId: id,
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
        updatedAt: now,
      },
    });
  }
  return id;
}

/** Clone all rotation configs from source catalog preset onto athlete preset FKs. */
export async function cloneRotationsFromSourcePreset(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<{
  longRunConfigId: string | null;
  easyConfigId: string | null;
  intervalsConfigId: string | null;
  tempoConfigId: string | null;
}> {
  const source = await prisma.training_plan_preset.findUnique({
    where: { id: params.sourcePresetId },
    include: trainingPlanPresetInclude,
  });
  if (!source) {
    throw new Error("Source preset not found");
  }
  if (!source.longRunConfigId || !source.easyConfigId) {
    throw new Error("Source preset is missing long-run or easy rotation configs");
  }

  const suffix = ` (athlete ${params.athletePresetId.slice(0, 8)})`;

  const longRunConfigId = await cloneConfig("longRun", source.longRunConfigId, suffix);
  const easyConfigId = await cloneConfig("easy", source.easyConfigId, suffix);
  const intervalsConfigId = await cloneConfig("intervals", source.intervalsConfigId, suffix);
  const tempoConfigId = await cloneConfig("tempo", source.tempoConfigId, suffix);

  if (!longRunConfigId || !easyConfigId) {
    throw new Error("Failed to clone required rotation configs");
  }

  await prisma.athlete_presets.update({
    where: { id: params.athletePresetId },
    data: {
      longRunConfigId,
      easyConfigId,
      intervalsConfigId,
      tempoConfigId,
      updatedAt: new Date(),
    },
  });

  return { longRunConfigId, easyConfigId, intervalsConfigId, tempoConfigId };
}

/** Copy workoutStructure, coachPlanOverview, easyRunConfig from source catalog preset. */
export async function seedWorkoutBlueprintFromSource(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<void> {
  const source = await prisma.training_plan_preset.findUnique({
    where: { id: params.sourcePresetId },
    select: {
      workoutStructure: true,
      coachPlanOverview: true,
      easyRunConfig: true,
    },
  });
  if (!source) {
    throw new Error("Source preset not found");
  }

  await prisma.athlete_presets.update({
    where: { id: params.athletePresetId },
    data: {
      workoutStructure: source.workoutStructure ?? undefined,
      coachPlanOverview: source.coachPlanOverview ?? undefined,
      easyRunConfig: source.easyRunConfig ?? undefined,
      updatedAt: new Date(),
    },
  });
}
