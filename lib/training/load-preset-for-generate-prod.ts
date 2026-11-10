import { prisma } from "@/lib/prisma";
import { phaseWeekRowsFromLegacyTaper } from "@/lib/training/phase-week-pins";
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
  const buildInclude = {
    include: {
      longRunConfig: rotationInclude,
      easyConfig: rotationInclude,
      tempoConfig: rotationInclude,
      intervalsConfig: rotationInclude,
    },
  } as const;

  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    include: {
      baseBuildPreset: buildInclude,
      buildPreset: buildInclude,
      taperPreset: true,
      raceWeekPreset: true,
    },
  });
  if (!row) return null;

  function phaseBuildFrom(
    build: typeof row.buildPreset | typeof row.baseBuildPreset,
  ): TrainingManagePresetForGenerate["build"] {
    if (!build) return null;
    return {
      startLongRunMiles: build.startLongRunMiles,
      peakLongRunMiles: build.peakLongRunMiles,
      peakWeeklyMiles: build.maxWeeklyMiles,
      longRunCutback: build.longRunCutback,
      longRunConfigId: build.longRunConfigId,
      easyConfigId: build.easyConfigId,
      tempoConfigId: build.tempoConfigId,
      intervalsConfigId: build.intervalsConfigId,
      longRunConfig: mapRotation(build.longRunConfig),
      easyConfig: mapRotation(build.easyConfig),
      tempoConfig: mapRotation(build.tempoConfig),
      intervalsConfig: mapRotation(build.intervalsConfig),
    };
  }

  const build = row.buildPreset;

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
    coachPlanOverview: null,
    workoutStructure: null,
    easyRunConfig: null,
    baseBuild: phaseBuildFrom(row.baseBuildPreset),
    build: phaseBuildFrom(build),
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

  return loaded;
}
