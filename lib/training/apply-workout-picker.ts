import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";
import type { RunTypePositionInput } from "@/lib/training/run-type-config-parser";
import { validateRunTypePositionsForSave } from "@/lib/training/run-type-config-validation";

export type ConfigPickerBlock = {
  name: string;
  description?: string | null;
  positions: RunTypePositionInput[];
};

export type WorkoutPickerApplyInput = {
  cycleLen: number;
  longRun: ConfigPickerBlock;
  easy: ConfigPickerBlock;
  intervals?: ConfigPickerBlock | null;
  tempo?: ConfigPickerBlock | null;
};

async function createConfigWithPositions(opts: {
  kind: "longRun" | "intervals" | "tempo" | "easy";
  block: ConfigPickerBlock;
  expectedWorkoutType: "LongRun" | "Intervals" | "Tempo" | "Easy";
  configLabel: string;
}): Promise<string> {
  const validated = await validateRunTypePositionsForSave({
    rows: opts.block.positions,
    configLabel: opts.configLabel,
    expectedWorkoutType: opts.expectedWorkoutType,
  });
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const now = new Date();
  const id = newEntityId();

  if (opts.kind === "longRun") {
    await prisma.long_run_config.create({
      data: {
        id,
        name: opts.block.name.trim(),
        description: opts.block.description?.trim() || null,
        updatedAt: now,
      },
    });
    for (const row of opts.block.positions) {
      await prisma.long_run_config_position.create({
        data: {
          id: newEntityId(),
          longRunConfigId: id,
          cyclePosition: row.cyclePosition,
          distributionWeight: row.distributionWeight,
          catalogueWorkoutId: row.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  if (opts.kind === "intervals") {
    await prisma.intervals_config.create({
      data: {
        id,
        name: opts.block.name.trim(),
        description: opts.block.description?.trim() || null,
        updatedAt: now,
      },
    });
    for (const row of opts.block.positions) {
      await prisma.intervals_config_position.create({
        data: {
          id: newEntityId(),
          intervalsConfigId: id,
          cyclePosition: row.cyclePosition,
          distributionWeight: row.distributionWeight,
          catalogueWorkoutId: row.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  if (opts.kind === "tempo") {
    await prisma.tempo_config.create({
      data: {
        id,
        name: opts.block.name.trim(),
        description: opts.block.description?.trim() || null,
        updatedAt: now,
      },
    });
    for (const row of opts.block.positions) {
      await prisma.tempo_config_position.create({
        data: {
          id: newEntityId(),
          tempoConfigId: id,
          cyclePosition: row.cyclePosition,
          distributionWeight: row.distributionWeight,
          catalogueWorkoutId: row.catalogueWorkoutId,
          updatedAt: now,
        },
      });
    }
    return id;
  }

  await prisma.easy_config.create({
    data: {
      id,
      name: opts.block.name.trim(),
      description: opts.block.description?.trim() || null,
      updatedAt: now,
    },
  });
  for (const row of opts.block.positions) {
    await prisma.easy_config_position.create({
      data: {
        id: newEntityId(),
        easyConfigId: id,
        cyclePosition: row.cyclePosition,
        distributionWeight: row.distributionWeight,
        catalogueWorkoutId: row.catalogueWorkoutId,
        updatedAt: now,
      },
    });
  }
  return id;
}

export async function applyWorkoutPickerToPreset(
  presetId: string,
  input: WorkoutPickerApplyInput
): Promise<{
  longRunConfigId: string;
  easyConfigId: string;
  intervalsConfigId: string | null;
  tempoConfigId: string | null;
}> {
  const preset = await prisma.training_plan_preset.findUnique({ where: { id: presetId } });
  if (!preset) {
    throw new Error("Preset not found");
  }

  const cycleLen = Math.max(1, Math.min(8, Math.round(input.cycleLen)));

  const longRunConfigId = await createConfigWithPositions({
    kind: "longRun",
    block: input.longRun,
    expectedWorkoutType: "LongRun",
    configLabel: "Long run rotation",
  });

  const easyConfigId = await createConfigWithPositions({
    kind: "easy",
    block: input.easy,
    expectedWorkoutType: "Easy",
    configLabel: "Easy rotation",
  });

  let intervalsConfigId: string | null = null;
  if (input.intervals?.positions?.length) {
    intervalsConfigId = await createConfigWithPositions({
      kind: "intervals",
      block: input.intervals,
      expectedWorkoutType: "Intervals",
      configLabel: "Intervals rotation",
    });
  }

  let tempoConfigId: string | null = null;
  if (input.tempo?.positions?.length) {
    tempoConfigId = await createConfigWithPositions({
      kind: "tempo",
      block: input.tempo,
      expectedWorkoutType: "Tempo",
      configLabel: "Tempo rotation",
    });
  }

  await prisma.training_plan_preset.update({
    where: { id: presetId },
    data: {
      cycleLen,
      longRunConfigId,
      easyConfigId,
      intervalsConfigId,
      tempoConfigId,
    },
  });

  return { longRunConfigId, easyConfigId, intervalsConfigId, tempoConfigId };
}
