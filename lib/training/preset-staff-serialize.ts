import type { Prisma } from "@prisma/client";
import { poolsFromBuildPeakLongRun } from "@/lib/training/catalog-preset-rotation";

const buildPresetStaffInclude = {
  include: {
    longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" as const } } } },
    easyConfig: true,
    tempoConfig: true,
    intervalsConfig: true,
  },
} as const;

export const staffPlanPresetInclude = {
  baseBuildPreset: buildPresetStaffInclude,
  buildPreset: buildPresetStaffInclude,
  taperPreset: {
    select: {
      id: true,
      name: true,
      week1TotalMiles: true,
      week1LongRunMiles: true,
      week2TotalMiles: true,
      week2LongRunMiles: true,
    },
  },
  raceWeekPreset: { select: { id: true, title: true } },
} as const;

export type StaffPresetRow = Prisma.training_plan_presetGetPayload<{
  include: typeof staffPlanPresetInclude;
}>;

export function serializeStaffPlanPreset(row: StaffPresetRow) {
  const build = row.buildPreset;
  const pools = poolsFromBuildPeakLongRun(build?.peakLongRunMiles ?? null);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publicDescription: row.publicDescription,
    targetDistanceLabel: row.targetDistanceLabel,
    coachIntent: row.coachIntent,
    personaId: row.personaId,
    goalId: row.goalId,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    baseBuildPresetId: row.baseBuildPresetId,
    buildPresetId: row.buildPresetId,
    taperPresetId: row.taperPresetId,
    raceWeekPresetId: row.raceWeekPresetId,
    snapPeakLongRunMiles: build?.peakLongRunMiles ?? null,
    snapPeakWeeklyMiles: build?.maxWeeklyMiles ?? null,
    snapTaperWeek1TotalMiles: row.taperPreset?.week1TotalMiles ?? null,
    snapTaperWeek1LongRunMiles: row.taperPreset?.week1LongRunMiles ?? null,
    snapTaperWeek2TotalMiles: row.taperPreset?.week2TotalMiles ?? null,
    snapTaperWeek2LongRunMiles: row.taperPreset?.week2LongRunMiles ?? null,
    longRunConfigId: build?.longRunConfigId ?? null,
    easyConfigId: build?.easyConfigId ?? null,
    tempoConfigId: build?.tempoConfigId ?? null,
    intervalsConfigId: build?.intervalsConfigId ?? null,
    baseLongRunPoolMiles: pools.baseLongRunPoolMiles,
    peakLongRunPoolMiles: pools.peakLongRunPoolMiles,
    taperLongRunPoolMiles: pools.taperLongRunPoolMiles,
    baseBuildPreset:
      row.baseBuildPreset != null
        ? { id: row.baseBuildPreset.id, name: row.baseBuildPreset.name }
        : null,
    buildPreset:
      build != null ? { id: build.id, name: build.name } : null,
    taperPreset:
      row.taperPreset != null ? { id: row.taperPreset.id, name: row.taperPreset.name } : null,
    raceWeekPreset:
      row.raceWeekPreset != null
        ? { id: row.raceWeekPreset.id, title: row.raceWeekPreset.title }
        : null,
    longRunConfig: build?.longRunConfig
      ? {
          id: build.longRunConfig.id,
          name: build.longRunConfig.name,
          positions: build.longRunConfig.positions.map((p) => ({
            cyclePosition: p.cyclePosition,
            catalogueWorkoutId: p.catalogueWorkoutId,
            distributionWeight: p.distributionWeight,
          })),
        }
      : null,
    easyConfig: build?.easyConfig
      ? { id: build.easyConfig.id, name: build.easyConfig.name }
      : null,
    tempoConfig: build?.tempoConfig
      ? { id: build.tempoConfig.id, name: build.tempoConfig.name }
      : null,
    intervalsConfig: build?.intervalsConfig
      ? { id: build.intervalsConfig.id, name: build.intervalsConfig.name }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
