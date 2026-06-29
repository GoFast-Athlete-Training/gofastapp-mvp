import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";

export type RotationType = "LongRun" | "Easy" | "Tempo" | "Intervals";

export type RotationSlotInput = {
  cyclePosition: number;
  catalogueWorkoutId: string;
  distributionWeight?: number;
};

async function replaceLongRunPositions(
  configId: string,
  slots: RotationSlotInput[],
  now: Date
) {
  await prisma.$transaction(async (tx) => {
    await tx.long_run_config_position.deleteMany({ where: { longRunConfigId: configId } });
    for (const slot of slots) {
      await tx.long_run_config_position.create({
        data: {
          id: newEntityId(),
          longRunConfigId: configId,
          cyclePosition: slot.cyclePosition,
          distributionWeight: slot.distributionWeight ?? 0.25,
          catalogueWorkoutId: slot.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
  });
}

async function replaceEasyPositions(configId: string, slots: RotationSlotInput[], now: Date) {
  await prisma.$transaction(async (tx) => {
    await tx.easy_config_position.deleteMany({ where: { easyConfigId: configId } });
    for (const slot of slots) {
      await tx.easy_config_position.create({
        data: {
          id: newEntityId(),
          easyConfigId: configId,
          cyclePosition: slot.cyclePosition,
          distributionWeight: slot.distributionWeight ?? 0.25,
          catalogueWorkoutId: slot.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
  });
}

async function replaceTempoPositions(configId: string, slots: RotationSlotInput[], now: Date) {
  await prisma.$transaction(async (tx) => {
    await tx.tempo_config_position.deleteMany({ where: { tempoConfigId: configId } });
    for (const slot of slots) {
      await tx.tempo_config_position.create({
        data: {
          id: newEntityId(),
          tempoConfigId: configId,
          cyclePosition: slot.cyclePosition,
          distributionWeight: slot.distributionWeight ?? 0.25,
          catalogueWorkoutId: slot.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
  });
}

async function replaceIntervalsPositions(
  configId: string,
  slots: RotationSlotInput[],
  now: Date
) {
  await prisma.$transaction(async (tx) => {
    await tx.intervals_config_position.deleteMany({ where: { intervalsConfigId: configId } });
    for (const slot of slots) {
      await tx.intervals_config_position.create({
        data: {
          id: newEntityId(),
          intervalsConfigId: configId,
          cyclePosition: slot.cyclePosition,
          distributionWeight: slot.distributionWeight ?? 0.25,
          catalogueWorkoutId: slot.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
  });
}

export async function applyRotation(opts: {
  rotationType: RotationType;
  name: string;
  description?: string | null;
  configId?: string | null;
  slots: RotationSlotInput[];
}): Promise<{ configId: string }> {
  const now = new Date();
  let configId = opts.configId?.trim() || null;

  if (configId) {
    const exists = await (async () => {
      if (opts.rotationType === "LongRun") {
        return prisma.long_run_config.findUnique({ where: { id: configId! } });
      }
      if (opts.rotationType === "Easy") {
        return prisma.easy_config.findUnique({ where: { id: configId! } });
      }
      if (opts.rotationType === "Tempo") {
        return prisma.tempo_config.findUnique({ where: { id: configId! } });
      }
      return prisma.intervals_config.findUnique({ where: { id: configId! } });
    })();
    if (!exists) throw new Error("configId not found");
  } else {
    const base = {
      id: newEntityId(),
      name: opts.name.trim(),
      description: opts.description?.trim() || null,
      updatedAt: now,
    };
    if (opts.rotationType === "LongRun") {
      configId = (await prisma.long_run_config.create({ data: base })).id;
    } else if (opts.rotationType === "Easy") {
      configId = (await prisma.easy_config.create({ data: base })).id;
    } else if (opts.rotationType === "Tempo") {
      configId = (await prisma.tempo_config.create({ data: base })).id;
    } else {
      configId = (await prisma.intervals_config.create({ data: base })).id;
    }
  }

  if (opts.rotationType === "LongRun") {
    await replaceLongRunPositions(configId!, opts.slots, now);
  } else if (opts.rotationType === "Easy") {
    await replaceEasyPositions(configId!, opts.slots, now);
  } else if (opts.rotationType === "Tempo") {
    await replaceTempoPositions(configId!, opts.slots, now);
  } else {
    await replaceIntervalsPositions(configId!, opts.slots, now);
  }

  return { configId: configId! };
}

export async function linkRotationToPreset(
  presetId: string,
  rotationType: RotationType,
  configId: string
) {
  const data =
    rotationType === "LongRun"
      ? { longRunConfigId: configId }
      : rotationType === "Easy"
        ? { easyConfigId: configId }
        : rotationType === "Tempo"
          ? { tempoConfigId: configId }
          : { intervalsConfigId: configId };

  return prisma.training_plan_preset.update({
    where: { id: presetId },
    data,
  });
}
