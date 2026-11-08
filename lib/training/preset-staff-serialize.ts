import type {
  easy_config,
  intervals_config,
  long_run_config,
  long_run_config_position,
  race_week_preset,
  tempo_config,
  training_plan_preset,
} from "@prisma/client";

type ConfigWithPositions = long_run_config & {
  positions: long_run_config_position[];
};

export function serializeStaffPlanPreset(
  row: training_plan_preset & {
    longRunConfig?: ConfigWithPositions | null;
    easyConfig?: easy_config | null;
    tempoConfig?: tempo_config | null;
    intervalsConfig?: intervals_config | null;
    buildPreset?: { id: string; name: string } | null;
    taperPreset?: { id: string; name: string } | null;
    raceWeekPreset?: { id: string; title: string } | null;
  },
) {
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
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    buildPresetId: row.buildPresetId,
    taperPresetId: row.taperPresetId,
    raceWeekPresetId: row.raceWeekPresetId,
    snapPeakLongRunMiles: row.snapPeakLongRunMiles,
    snapPeakWeeklyMiles: row.snapPeakWeeklyMiles,
    snapTaperWeek1TotalMiles: row.snapTaperWeek1TotalMiles,
    snapTaperWeek1LongRunMiles: row.snapTaperWeek1LongRunMiles,
    snapTaperWeek2TotalMiles: row.snapTaperWeek2TotalMiles,
    snapTaperWeek2LongRunMiles: row.snapTaperWeek2LongRunMiles,
    buildPreset:
      row.buildPreset != null ? { id: row.buildPreset.id, name: row.buildPreset.name } : null,
    taperPreset:
      row.taperPreset != null ? { id: row.taperPreset.id, name: row.taperPreset.name } : null,
    raceWeekPreset:
      row.raceWeekPreset != null
        ? { id: row.raceWeekPreset.id, title: row.raceWeekPreset.title }
        : null,
    longRunConfig: row.longRunConfig
      ? {
          id: row.longRunConfig.id,
          name: row.longRunConfig.name,
          positions: row.longRunConfig.positions.map((p) => ({
            cyclePosition: p.cyclePosition,
            catalogueWorkoutId: p.catalogueWorkoutId,
            distributionWeight: p.distributionWeight,
          })),
        }
      : null,
    easyConfig: row.easyConfig ? { id: row.easyConfig.id, name: row.easyConfig.name } : null,
    tempoConfig: row.tempoConfig ? { id: row.tempoConfig.id, name: row.tempoConfig.name } : null,
    intervalsConfig: row.intervalsConfig
      ? { id: row.intervalsConfig.id, name: row.intervalsConfig.name }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const staffPlanPresetInclude = {
  longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" as const } } } },
  easyConfig: true,
  tempoConfig: true,
  intervalsConfig: true,
  buildPreset: { select: { id: true, name: true } },
  taperPreset: { select: { id: true, name: true } },
  raceWeekPreset: { select: { id: true, title: true } },
} as const;
