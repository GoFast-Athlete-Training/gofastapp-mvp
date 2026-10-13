import { prisma } from "@/lib/prisma";
import { phaseWeekRowsFromLegacyTaper } from "@/lib/training/phase-week-pins";
import { mergePresetWithPhaseGenerateJson } from "@/lib/training/merge-preset-phase-generate-json";
import { parseRaceWeekSlots } from "@/lib/training/race-week-slots";
import { parseTaperWeekSlots } from "@/lib/training/taper-week-slots";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

const rotationInclude = {
  include: {
    positions: {
      orderBy: { cyclePosition: "asc" as const },
      select: {
        cyclePosition: true,
        catalogueWorkoutId: true,
        distributionWeight: true,
      },
    },
  },
} as const;

const planLegacyRotationInclude = {
  longRunConfig: rotationInclude,
  easyConfig: rotationInclude,
  tempoConfig: rotationInclude,
  intervalsConfig: rotationInclude,
} as const;

function mapRotation(config: {
  id: string;
  name: string;
  positions: {
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }[];
} | null) {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    positions: config.positions.map((p) => ({
      cyclePosition: p.cyclePosition,
      catalogueWorkoutId: p.catalogueWorkoutId,
      distributionWeight: p.distributionWeight,
    })),
  };
}

/** Load mirrored TM graph from prod DB (same shape as Training Manage loadPresetForGenerate). */
export async function loadPresetForGenerateFromProd(
  presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    include: {
      ...planLegacyRotationInclude,
      buildPreset: {
        include: {
          longRunConfig: rotationInclude,
          easyConfig: rotationInclude,
          tempoConfig: rotationInclude,
          intervalsConfig: rotationInclude,
        },
      },
      taperPreset: true,
      raceWeekPreset: true,
    },
  });
  if (!row) return null;

  const build = row.buildPreset;

  const buildLongRun = mapRotation(build?.longRunConfig ?? null);
  const buildEasy = mapRotation(build?.easyConfig ?? null);
  const buildTempo = mapRotation(build?.tempoConfig ?? null);
  const buildIntervals = mapRotation(build?.intervalsConfig ?? null);

  const legacyLongRun = mapRotation(row.longRunConfig);
  const legacyEasy = mapRotation(row.easyConfig);
  const legacyTempo = mapRotation(row.tempoConfig);
  const legacyIntervals = mapRotation(row.intervalsConfig);

  const taperSlots = row.taperPreset
    ? parseTaperWeekSlots(row.taperPreset.slots)
    : [];

  const loaded: TrainingManagePresetForGenerate = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    publicDescription: row.publicDescription,
    targetDistanceLabel: row.targetDistanceLabel,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    coachPlanOverview: row.coachPlanOverview,
    workoutStructure: row.workoutStructure,
    easyRunConfig: row.easyRunConfig,
    build: build
      ? {
          startLongRunMiles: build.startLongRunMiles,
          peakLongRunMiles: build.peakLongRunMiles,
          peakWeeklyMiles: build.maxWeeklyMiles,
          longRunCutback: build.longRunCutback,
          longRunConfigId: build.longRunConfigId,
          easyConfigId: build.easyConfigId,
          tempoConfigId: build.tempoConfigId,
          intervalsConfigId: build.intervalsConfigId,
          longRunConfig: buildLongRun ?? legacyLongRun,
          easyConfig: buildEasy ?? legacyEasy,
          tempoConfig: buildTempo ?? legacyTempo,
          intervalsConfig: buildIntervals ?? legacyIntervals,
        }
      : legacyLongRun || legacyEasy || legacyTempo || legacyIntervals
        ? {
            startLongRunMiles: null,
            peakLongRunMiles: row.snapPeakLongRunMiles,
            peakWeeklyMiles: row.snapPeakWeeklyMiles,
            longRunCutback: null,
            longRunConfigId: row.longRunConfigId,
            easyConfigId: row.easyConfigId,
            tempoConfigId: row.tempoConfigId,
            intervalsConfigId: row.intervalsConfigId,
            longRunConfig: legacyLongRun,
            easyConfig: legacyEasy,
            tempoConfig: legacyTempo,
            intervalsConfig: legacyIntervals,
          }
        : null,
    taper: row.taperPreset
      ? {
          name: row.taperPreset.name,
          weeks: phaseWeekRowsFromLegacyTaper(row.taperPreset),
          slots: taperSlots.length > 0 ? taperSlots : undefined,
        }
      : null,
    raceWeek: row.raceWeekPreset
      ? {
          title: row.raceWeekPreset.title,
          slots: parseRaceWeekSlots(row.raceWeekPreset.slots),
        }
      : null,
  };

  return mergePresetWithPhaseGenerateJson(loaded, row.presetPhaseGenerateJson);
}
