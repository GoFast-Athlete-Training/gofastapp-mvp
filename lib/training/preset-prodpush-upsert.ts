import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

export type PresetProdPushBody = {
  preset: Record<string, unknown>;
  phaseGenerate: TrainingManagePresetForGenerate;
  lastSyncedByStaffId?: string | null;
};

type Tx = Prisma.TransactionClient;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function int(v: unknown, fallback: number): number {
  const n = num(v);
  return n != null ? Math.round(n) : fallback;
}

function record(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function poolMilesFromPhaseGenerate(phase: TrainingManagePresetForGenerate): {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
} {
  const peakSingle = phase.build?.peakLongRunMiles;
  const peakPool =
    peakSingle != null && Number.isFinite(peakSingle) ? peakSingle * 4 : 0;
  return {
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
  };
}

type RotationPayload = {
  id: string;
  name: string;
  positions: {
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }[];
};

function rotationFromUnknown(raw: unknown): RotationPayload | null {
  const r = record(raw);
  if (!r) return null;
  const id = str(r.id);
  const name = str(r.name);
  if (!id || !name) return null;
  const positions = Array.isArray(r.positions)
    ? r.positions
        .map((item) => {
          const pos = record(item);
          if (!pos) return null;
          return {
            cyclePosition: int(pos.cyclePosition, 0),
            catalogueWorkoutId: str(pos.catalogueWorkoutId) ?? null,
            distributionWeight: num(pos.distributionWeight) ?? 0.25,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null)
    : [];
  return { id, name, positions };
}

async function upsertLongRunConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.long_run_config.upsert({
    where: { id },
    create: { id, name },
    update: { name },
  });
  for (const p of positions) {
    await tx.long_run_config_position.upsert({
      where: {
        longRunConfigId_cyclePosition: {
          longRunConfigId: id,
          cyclePosition: p.cyclePosition,
        },
      },
      create: {
        longRunConfigId: id,
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertIntervalsConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.intervals_config.upsert({
    where: { id },
    create: { id, name },
    update: { name },
  });
  for (const p of positions) {
    await tx.intervals_config_position.upsert({
      where: {
        intervalsConfigId_cyclePosition: {
          intervalsConfigId: id,
          cyclePosition: p.cyclePosition,
        },
      },
      create: {
        intervalsConfigId: id,
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertTempoConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.tempo_config.upsert({
    where: { id },
    create: { id, name },
    update: { name },
  });
  for (const p of positions) {
    await tx.tempo_config_position.upsert({
      where: {
        tempoConfigId_cyclePosition: {
          tempoConfigId: id,
          cyclePosition: p.cyclePosition,
        },
      },
      create: {
        tempoConfigId: id,
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertEasyConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.easy_config.upsert({
    where: { id },
    create: { id, name },
    update: { name },
  });
  for (const p of positions) {
    await tx.easy_config_position.upsert({
      where: {
        easyConfigId_cyclePosition: {
          easyConfigId: id,
          cyclePosition: p.cyclePosition,
        },
      },
      create: {
        easyConfigId: id,
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
      },
    });
  }
  return id;
}

function buildRotationsFromPhase(phase: TrainingManagePresetForGenerate) {
  const build = phase.build;
  if (!build) return { longRun: null, intervals: null, tempo: null, easy: null };
  return {
    longRun: rotationFromUnknown(build.longRunConfig),
    intervals: rotationFromUnknown(build.intervalsConfig),
    tempo: rotationFromUnknown(build.tempoConfig),
    easy: rotationFromUnknown(build.easyConfig),
  };
}

export async function upsertPresetFromProdPush(
  body: PresetProdPushBody,
): Promise<{ presetId: string }> {
  const p = body.preset;
  const id = str(p.id);
  const title = str(p.title);
  const slugIn = str(p.slug);
  if (!id || !title || !slugIn) {
    throw new Error("preset.id, preset.title, and preset.slug are required");
  }
  if (!body.phaseGenerate?.id || body.phaseGenerate.id !== id) {
    throw new Error("phaseGenerate.id must match preset.id");
  }

  const pools = poolMilesFromPhaseGenerate(body.phaseGenerate);
  const basePool = num(p.baseLongRunPoolMiles) ?? pools.baseLongRunPoolMiles;
  const peakPool = num(p.peakLongRunPoolMiles) ?? pools.peakLongRunPoolMiles;
  const taperPool = num(p.taperLongRunPoolMiles) ?? pools.taperLongRunPoolMiles;

  const rotations = buildRotationsFromPhase(body.phaseGenerate);

  await prisma.$transaction(async (tx) => {
    const longRunConfigId = rotations.longRun
      ? await upsertLongRunConfig(tx, rotations.longRun)
      : null;
    const intervalsConfigId = rotations.intervals
      ? await upsertIntervalsConfig(tx, rotations.intervals)
      : null;
    const tempoConfigId = rotations.tempo ? await upsertTempoConfig(tx, rotations.tempo) : null;
    const easyConfigId = rotations.easy ? await upsertEasyConfig(tx, rotations.easy) : null;

    let slug = slugIn;
    const existing = await tx.training_plan_preset.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (existing) {
      const clash = await tx.training_plan_preset.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (clash && clash.id !== id) slug = existing.slug;
    } else {
      const clash = await tx.training_plan_preset.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (clash && clash.id !== id) {
        slug = `${slugIn}-mirror`;
      }
    }

    const data: Prisma.training_plan_presetUncheckedCreateInput = {
      id,
      slug,
      title,
      description: str(p.description) ?? null,
      publicDescription: str(p.publicDescription) ?? null,
      targetDistanceLabel: str(p.targetDistanceLabel) ?? null,
      personaId: str(p.personaId) ?? null,
      goalId: str(p.goalId) ?? null,
      coachIntent: str(p.coachIntent) ?? null,
      coachPlanOverview: (p.coachPlanOverview as Prisma.InputJsonValue) ?? undefined,
      workoutStructure: (p.workoutStructure as Prisma.InputJsonValue) ?? undefined,
      easyRunConfig: (p.easyRunConfig as Prisma.InputJsonValue) ?? undefined,
      longRunCycleWeeks: num(p.longRunCycleWeeks) ?? 4,
      minWeeklyMiles: int(p.minWeeklyMiles, body.phaseGenerate.minWeeklyMiles),
      maxWeeklyMiles:
        num(p.maxWeeklyMiles) ?? body.phaseGenerate.maxWeeklyMiles ?? null,
      baseLongRunPoolMiles: basePool,
      peakLongRunPoolMiles: peakPool,
      taperLongRunPoolMiles: taperPool,
      tempoIdealDow: int(p.tempoIdealDow, body.phaseGenerate.tempoIdealDow),
      intervalIdealDow: int(p.intervalIdealDow, body.phaseGenerate.intervalIdealDow),
      longRunDefaultDow: int(p.longRunDefaultDow, body.phaseGenerate.longRunDefaultDow),
      longRunConfigId,
      intervalsConfigId,
      tempoConfigId,
      easyConfigId,
      presetPhaseGenerateJson: body.phaseGenerate as unknown as Prisma.InputJsonValue,
      lastSyncedByStaffId: body.lastSyncedByStaffId?.trim() || null,
    };

    const { id: _id, slug: _slug, ...updateData } = data;
    await tx.training_plan_preset.upsert({
      where: { id },
      create: data,
      update: updateData,
    });
  });

  return { presetId: id };
}
