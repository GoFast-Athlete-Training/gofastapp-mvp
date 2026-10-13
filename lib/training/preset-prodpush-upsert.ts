import { prisma } from "@/lib/prisma";
import type { Prisma, WorkoutType } from "@prisma/client";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

export type PresetProdPushBody = {
  plan: Record<string, unknown>;
  buildPreset?: Record<string, unknown> | null;
  taperPreset?: Record<string, unknown> | null;
  raceWeekPreset?: Record<string, unknown> | null;
  shakeoutRunConfigs?: Record<string, unknown>[];
  workoutCatalogues?: Record<string, unknown>[];
  phaseGenerate?: TrainingManagePresetForGenerate | null;
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

function catalogueFromPosition(pos: Record<string, unknown>): Record<string, unknown> | null {
  return record(pos.workout_catalogue) ?? record(pos.workoutCatalogue);
}

async function uniqueSlug(tx: Tx, id: string, slug: string): Promise<string> {
  let candidate = slug;
  let n = 0;
  while (true) {
    const clash = await tx.training_plan_preset.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === id) return candidate;
    n += 1;
    candidate = n === 1 ? `${slug}-mirror` : `${slug}-mirror-${n}`;
  }
}

function workoutCatalogueScalars(raw: Record<string, unknown>, slug: string | null) {
  const workoutType = raw.workoutType as WorkoutType;
  if (!workoutType) {
    throw new Error("workout_catalogue.workoutType is required");
  }
  const trainingIntent = Array.isArray(raw.trainingIntent)
    ? raw.trainingIntent.filter((x): x is string => typeof x === "string")
    : [];

  return {
    name: str(raw.name) ?? "Workout",
    runSubType: str(raw.runSubType) ?? null,
    slug,
    description: str(raw.description) ?? null,
    workoutType,
    segmentPaceDist: (raw.segmentPaceDist as Prisma.InputJsonValue) ?? undefined,
    warmupFraction: num(raw.warmupFraction) ?? null,
    workFraction: num(raw.workFraction) ?? null,
    cooldownFraction: num(raw.cooldownFraction) ?? null,
    workBaseReps: num(raw.workBaseReps) ?? null,
    workBaseRepMeters: num(raw.workBaseRepMeters) ?? null,
    recoveryDistanceMeters: num(raw.recoveryDistanceMeters) ?? null,
    recoveryDurationSeconds: num(raw.recoveryDurationSeconds) ?? null,
    warmupMiles: num(raw.warmupMiles) ?? null,
    warmupPaceOffsetSecPerMile: num(raw.warmupPaceOffsetSecPerMile) ?? null,
    cooldownMiles: num(raw.cooldownMiles) ?? null,
    cooldownPaceOffsetSecPerMile: num(raw.cooldownPaceOffsetSecPerMile) ?? null,
    workBaseMiles: num(raw.workBaseMiles) ?? null,
    workPaceOffsetSecPerMile: num(raw.workPaceOffsetSecPerMile) ?? null,
    workBasePaceOffsetSecPerMile: num(raw.workBasePaceOffsetSecPerMile) ?? null,
    recoveryPaceOffsetSecPerMile: num(raw.recoveryPaceOffsetSecPerMile) ?? null,
    paceAnchor: str(raw.paceAnchor) ?? "currentBuildup",
    mpFraction: num(raw.mpFraction) ?? null,
    mpBlockPosition: str(raw.mpBlockPosition) ?? null,
    mpBlockProgression: str(raw.mpBlockProgression) ?? "flat",
    mpTotalMiles: num(raw.mpTotalMiles) ?? null,
    mpPaceOffsetSecPerMile: num(raw.mpPaceOffsetSecPerMile) ?? null,
    intendedHeartRateZone: str(raw.intendedHeartRateZone) ?? null,
    intendedHRBpmLow: num(raw.intendedHRBpmLow) ?? null,
    intendedHRBpmHigh: num(raw.intendedHRBpmHigh) ?? null,
    notes: str(raw.notes) ?? null,
    trainingIntent,
  };
}

async function upsertWorkoutCatalogue(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  if (!id) return null;
  const baseSlug = str(raw.slug);
  let slug: string | null = baseSlug ?? null;
  if (slug) {
    const clash = await tx.workout_catalogue.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) slug = `${slug}-${id.slice(-6)}`;
  }
  const scalars = workoutCatalogueScalars(raw, slug);
  await tx.workout_catalogue.upsert({
    where: { id },
    create: { id, ...scalars },
    update: scalars,
  });
  return id;
}

async function resolveCatalogueWorkoutId(
  tx: Tx,
  catalogueWorkoutId: string | null,
): Promise<string | null> {
  if (!catalogueWorkoutId) return null;
  const row = await tx.workout_catalogue.findUnique({
    where: { id: catalogueWorkoutId },
    select: { id: true },
  });
  return row?.id ?? null;
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

function rotationFromConfigRaw(raw: unknown): RotationPayload | null {
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
          const catRaw = catalogueFromPosition(pos);
          const catalogueWorkoutId =
            str(pos.catalogueWorkoutId) ?? (catRaw ? str(catRaw.id) : null) ?? null;
          return {
            cyclePosition: int(pos.cyclePosition, 0),
            catalogueWorkoutId,
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
    create: { id, name, description: null },
    update: { name },
  });
  for (const p of positions) {
    const catalogueWorkoutId = await resolveCatalogueWorkoutId(tx, p.catalogueWorkoutId);
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
        catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertIntervalsConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.intervals_config.upsert({
    where: { id },
    create: { id, name, description: null },
    update: { name },
  });
  for (const p of positions) {
    const catalogueWorkoutId = await resolveCatalogueWorkoutId(tx, p.catalogueWorkoutId);
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
        catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertTempoConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.tempo_config.upsert({
    where: { id },
    create: { id, name, description: null },
    update: { name },
  });
  for (const p of positions) {
    const catalogueWorkoutId = await resolveCatalogueWorkoutId(tx, p.catalogueWorkoutId);
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
        catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertEasyConfig(tx: Tx, rotation: RotationPayload): Promise<string> {
  const { id, name, positions } = rotation;
  await tx.easy_config.upsert({
    where: { id },
    create: { id, name, description: null },
    update: { name },
  });
  for (const p of positions) {
    const catalogueWorkoutId = await resolveCatalogueWorkoutId(tx, p.catalogueWorkoutId);
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
        catalogueWorkoutId,
      },
      update: {
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertRotationFromRaw(
  tx: Tx,
  raw: unknown,
  kind: "longRun" | "intervals" | "tempo" | "easy",
): Promise<string | null> {
  const rotation = rotationFromConfigRaw(raw);
  if (!rotation) return null;
  switch (kind) {
    case "longRun":
      return upsertLongRunConfig(tx, rotation);
    case "intervals":
      return upsertIntervalsConfig(tx, rotation);
    case "tempo":
      return upsertTempoConfig(tx, rotation);
    case "easy":
      return upsertEasyConfig(tx, rotation);
  }
}

async function upsertPhaseRotations(
  tx: Tx,
  phase: Record<string, unknown>,
): Promise<{
  longRunConfigId: string | null;
  intervalsConfigId: string | null;
  tempoConfigId: string | null;
  easyConfigId: string | null;
}> {
  const longRunConfigId = await upsertRotationFromRaw(
    tx,
    phase.longRunConfig ?? phase.long_run_config,
    "longRun",
  );
  const intervalsConfigId = await upsertRotationFromRaw(
    tx,
    phase.intervalsConfig ?? phase.intervals_config,
    "intervals",
  );
  const tempoConfigId = await upsertRotationFromRaw(
    tx,
    phase.tempoConfig ?? phase.tempo_config,
    "tempo",
  );
  const easyConfigId = await upsertRotationFromRaw(
    tx,
    phase.easyConfig ?? phase.easy_config,
    "easy",
  );
  return { longRunConfigId, intervalsConfigId, tempoConfigId, easyConfigId };
}

async function upsertBuildPreset(tx: Tx, raw: Record<string, unknown>): Promise<string> {
  const id = str(raw.id)!;
  const name = str(raw.name) ?? "Build";
  const rotations = await upsertPhaseRotations(tx, raw);
  const data = {
    name,
    startLongRunMiles: num(raw.startLongRunMiles) ?? null,
    peakLongRunMiles: num(raw.peakLongRunMiles) ?? null,
    longRunCutback: num(raw.longRunCutback) ?? null,
    maxWeeklyMiles: num(raw.maxWeeklyMiles) != null ? int(raw.maxWeeklyMiles, 0) : null,
    longRunConfigId: rotations.longRunConfigId ?? str(raw.longRunConfigId) ?? null,
    intervalsConfigId: rotations.intervalsConfigId ?? str(raw.intervalsConfigId) ?? null,
    tempoConfigId: rotations.tempoConfigId ?? str(raw.tempoConfigId) ?? null,
    easyConfigId: rotations.easyConfigId ?? str(raw.easyConfigId) ?? null,
  };
  await tx.build_preset.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  return id;
}

async function upsertTaperPreset(tx: Tx, raw: Record<string, unknown>): Promise<string> {
  const id = str(raw.id)!;
  const name = str(raw.name) ?? "Taper";
  const rotations = await upsertPhaseRotations(tx, raw);
  const data = {
    name,
    week1TotalMiles: num(raw.week1TotalMiles) ?? null,
    week1LongRunMiles: num(raw.week1LongRunMiles) ?? null,
    week2TotalMiles: num(raw.week2TotalMiles) ?? null,
    week2LongRunMiles: num(raw.week2LongRunMiles) ?? null,
    weekPins: (raw.weekPins as Prisma.InputJsonValue) ?? [],
    longRunConfigId: rotations.longRunConfigId ?? str(raw.longRunConfigId) ?? null,
    intervalsConfigId: rotations.intervalsConfigId ?? str(raw.intervalsConfigId) ?? null,
    tempoConfigId: rotations.tempoConfigId ?? str(raw.tempoConfigId) ?? null,
    easyConfigId: rotations.easyConfigId ?? str(raw.easyConfigId) ?? null,
  };
  await tx.taper_preset.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  return id;
}

async function upsertRaceWeekPreset(tx: Tx, raw: Record<string, unknown>): Promise<string> {
  const id = str(raw.id)!;
  const title = str(raw.title) ?? "Race week";
  await tx.race_week_preset.upsert({
    where: { id },
    create: {
      id,
      title,
      slots: (raw.slots as Prisma.InputJsonValue) ?? [],
    },
    update: {
      title,
      slots: (raw.slots as Prisma.InputJsonValue) ?? [],
    },
  });
  return id;
}

async function upsertShakeout(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const name = str(raw.name);
  const totalMiles = num(raw.totalMiles);
  if (!id || !name || totalMiles == null) return null;
  await tx.shakeout_run_config.upsert({
    where: { id },
    create: {
      id,
      name,
      totalMiles,
      paceOffsetSecPerMile: int(raw.paceOffsetSecPerMile, 0),
    },
    update: {
      name,
      totalMiles,
      paceOffsetSecPerMile: int(raw.paceOffsetSecPerMile, 0),
    },
  });
  return id;
}

function poolMilesFromBuild(build: Record<string, unknown> | null): {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
} {
  const peakSingle = build ? num(build.peakLongRunMiles) : undefined;
  const peakPool =
    peakSingle != null && Number.isFinite(peakSingle) ? peakSingle * 4 : 0;
  return {
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
  };
}

export async function upsertPresetFromProdPush(
  body: PresetProdPushBody,
): Promise<{ presetId: string }> {
  const plan = body.plan;
  const id = str(plan.id);
  const title = str(plan.title);
  const slugIn = str(plan.slug);
  if (!id || !title || !slugIn) {
    throw new Error("plan.id, plan.title, and plan.slug are required");
  }

  await prisma.$transaction(async (tx) => {
    for (const cat of body.workoutCatalogues ?? []) {
      const raw = record(cat);
      if (raw) await upsertWorkoutCatalogue(tx, raw);
    }

    for (const shake of body.shakeoutRunConfigs ?? []) {
      const raw = record(shake);
      if (raw) await upsertShakeout(tx, raw);
    }

    let buildPresetId: string | null = null;
    let taperPresetId: string | null = null;
    let raceWeekPresetId: string | null = null;

    const buildRaw = record(body.buildPreset);
    if (buildRaw && str(buildRaw.id)) {
      buildPresetId = await upsertBuildPreset(tx, buildRaw);
    }

    const taperRaw = record(body.taperPreset);
    if (taperRaw && str(taperRaw.id)) {
      taperPresetId = await upsertTaperPreset(tx, taperRaw);
    }

    const raceRaw = record(body.raceWeekPreset);
    if (raceRaw && str(raceRaw.id)) {
      raceWeekPresetId = await upsertRaceWeekPreset(tx, raceRaw);
    }

    const pools = poolMilesFromBuild(buildRaw);
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
      slug = await uniqueSlug(tx, id, slug);
    }

    const data: Prisma.training_plan_presetUncheckedCreateInput = {
      id,
      slug,
      title,
      description: str(plan.description) ?? null,
      publicDescription: str(plan.publicDescription) ?? null,
      targetDistanceLabel: str(plan.targetDistanceLabel) ?? null,
      personaId: str(plan.personaId) ?? null,
      goalId: str(plan.goalId) ?? null,
      coachIntent: str(plan.coachIntent) ?? null,
      objectiveOfPlan: str(plan.objectiveOfPlan) ?? null,
      athletePersonaCapability:
        (plan.athletePersonaCapability as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaCapability"]) ??
        null,
      athletePersonaGoal: str(plan.athletePersonaGoal) ?? null,
      athletePersonaDedication:
        (plan.athletePersonaDedication as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaDedication"]) ??
        null,
      coachPlanOverview: (plan.coachPlanOverview as Prisma.InputJsonValue) ?? undefined,
      workoutStructure: (plan.workoutStructure as Prisma.InputJsonValue) ?? undefined,
      easyRunConfig: (plan.easyRunConfig as Prisma.InputJsonValue) ?? undefined,
      longRunCycleWeeks: num(plan.longRunCycleWeeks) ?? 4,
      minWeeklyMiles: int(plan.minWeeklyMiles, 40),
      maxWeeklyMiles: num(plan.maxWeeklyMiles) ?? null,
      baseLongRunPoolMiles: num(plan.baseLongRunPoolMiles) ?? pools.baseLongRunPoolMiles,
      peakLongRunPoolMiles: num(plan.peakLongRunPoolMiles) ?? pools.peakLongRunPoolMiles,
      taperLongRunPoolMiles: num(plan.taperLongRunPoolMiles) ?? pools.taperLongRunPoolMiles,
      tempoIdealDow: int(plan.tempoIdealDow, 2),
      intervalIdealDow: int(plan.intervalIdealDow, 4),
      longRunDefaultDow: int(plan.longRunDefaultDow, 6),
      buildPresetId: buildPresetId ?? str(plan.buildPresetId) ?? null,
      taperPresetId: taperPresetId ?? str(plan.taperPresetId) ?? null,
      raceWeekPresetId: raceWeekPresetId ?? str(plan.raceWeekPresetId) ?? null,
      snapPeakLongRunMiles: num(plan.snapPeakLongRunMiles) ?? null,
      snapPeakWeeklyMiles: num(plan.snapPeakWeeklyMiles) ?? null,
      snapTaperWeek1TotalMiles: num(plan.snapTaperWeek1TotalMiles) ?? null,
      snapTaperWeek1LongRunMiles: num(plan.snapTaperWeek1LongRunMiles) ?? null,
      snapTaperWeek2TotalMiles: num(plan.snapTaperWeek2TotalMiles) ?? null,
      snapTaperWeek2LongRunMiles: num(plan.snapTaperWeek2LongRunMiles) ?? null,
      presetPhaseGenerateJson: body.phaseGenerate
        ? (body.phaseGenerate as unknown as Prisma.InputJsonValue)
        : undefined,
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
