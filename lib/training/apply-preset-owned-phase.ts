import type {
  PhaseRotationForGenerate,
  RaceWeekSlotForGenerate,
  TrainingManagePresetForGenerate,
} from "@/lib/training/fetch-training-manage-preset-for-generate";
import type { PhaseWeekRow } from "@/lib/training/phase-week-pins";

type PhaseBuild = NonNullable<TrainingManagePresetForGenerate["build"]>;

export type OwnedPhasePreset = {
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
  longRunConfig: PhaseRotationForGenerate;
  easyConfig: PhaseRotationForGenerate;
  tempoConfig: PhaseRotationForGenerate;
  intervalsConfig: PhaseRotationForGenerate;
};

export type OwnedPresetMiles = {
  entryLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  baseStartLongRunMiles: number | null;
  baseEndLongRunMiles: number | null;
  baseEndWeeklyMiles: number | null;
  baseWeeklyMinMiles: number | null;
  baseWeeklyMaxMiles: number | null;
  longRunCutback: number | null;
  taperWeek1TotalMiles: number | null;
  taperWeek1LongRunMiles: number | null;
  taperWeek2TotalMiles: number | null;
  taperWeek2LongRunMiles: number | null;
  raceWeekDayMiles: unknown;
  raceWeekMiles: number | null;
  baseBuildPhase: OwnedPhasePreset | null;
  buildToPeakPhase: OwnedPhasePreset | null;
};

function emptyBuild(): PhaseBuild {
  return {
    startLongRunMiles: null,
    peakLongRunMiles: null,
    peakWeeklyMiles: null,
    longRunCutback: null,
    weeklyMinMiles: null,
    longRunConfigId: null,
    easyConfigId: null,
    tempoConfigId: null,
    intervalsConfigId: null,
    longRunConfig: null,
    easyConfig: null,
    tempoConfig: null,
    intervalsConfig: null,
  };
}

function applyConfigs(target: PhaseBuild, phase: OwnedPhasePreset) {
  target.longRunConfigId = phase.longRunConfigId;
  target.easyConfigId = phase.easyConfigId;
  target.tempoConfigId = phase.tempoConfigId;
  target.intervalsConfigId = phase.intervalsConfigId;
  target.longRunConfig = phase.longRunConfig;
  target.easyConfig = phase.easyConfig;
  target.tempoConfig = phase.tempoConfig;
  target.intervalsConfig = phase.intervalsConfig;
}

export function parseRaceWeekDayMiles(
  raw: unknown,
): { offsetFromRace: number; prescribedMiles: number | null }[] | null {
  if (!Array.isArray(raw)) return null;
  const out: { offsetFromRace: number; prescribedMiles: number | null }[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const offset = typeof row.offsetFromRace === "number" ? row.offsetFromRace : Number(row.offsetFromRace);
    if (!Number.isFinite(offset)) continue;
    const milesRaw = row.prescribedMiles;
    const miles =
      milesRaw == null || milesRaw === ""
        ? null
        : typeof milesRaw === "number"
          ? milesRaw
          : Number(milesRaw);
    out.push({
      offsetFromRace: offset,
      prescribedMiles: miles != null && Number.isFinite(miles) ? miles : null,
    });
  }
  return out.length > 0 ? out : null;
}

function overlayTaperWeeks(
  loaded: TrainingManagePresetForGenerate,
  owned: OwnedPresetMiles,
) {
  const hasCaps =
    owned.taperWeek1TotalMiles != null ||
    owned.taperWeek1LongRunMiles != null ||
    owned.taperWeek2TotalMiles != null ||
    owned.taperWeek2LongRunMiles != null;
  if (!hasCaps) return;

  const weeks: PhaseWeekRow[] = loaded.taper?.weeks?.length
    ? loaded.taper.weeks.map((week) => ({ ...week, pins: [...week.pins] }))
    : [
        { weekIndex: 1, totalMilesCap: null, longRunCapMiles: null, pins: [] },
        { weekIndex: 2, totalMilesCap: null, longRunCapMiles: null, pins: [] },
      ];

  for (const week of weeks) {
    if (week.weekIndex === 1) {
      if (owned.taperWeek1TotalMiles != null) week.totalMilesCap = owned.taperWeek1TotalMiles;
      if (owned.taperWeek1LongRunMiles != null) week.longRunCapMiles = owned.taperWeek1LongRunMiles;
    }
    if (week.weekIndex === 2) {
      if (owned.taperWeek2TotalMiles != null) week.totalMilesCap = owned.taperWeek2TotalMiles;
      if (owned.taperWeek2LongRunMiles != null) week.longRunCapMiles = owned.taperWeek2LongRunMiles;
    }
  }

  loaded.taper = {
    name: loaded.taper?.name ?? "Taper",
    weeks,
    slots: loaded.taper?.slots,
  };
}

function overlayRaceWeekMiles(loaded: TrainingManagePresetForGenerate, raw: unknown) {
  const dayMiles = parseRaceWeekDayMiles(raw)?.filter((day) => day.prescribedMiles != null);
  if (!dayMiles?.length || !loaded.raceWeek) return;
  const byOffset = new Map(dayMiles.map((day) => [day.offsetFromRace, day.prescribedMiles]));
  const slots: RaceWeekSlotForGenerate[] = loaded.raceWeek.slots.map((slot) =>
    byOffset.has(slot.offsetFromRace)
      ? { ...slot, prescribedMiles: byOffset.get(slot.offsetFromRace) ?? null }
      : slot,
  );
  loaded.raceWeek = { ...loaded.raceWeek, slots };
}

/** Preset columns win when set. Phase-preset slots replace the copied build rotations. */
export function applyPresetOwnedPhase(
  loaded: TrainingManagePresetForGenerate,
  owned: OwnedPresetMiles,
): TrainingManagePresetForGenerate {
  const hasBuildMiles = owned.entryLongRunMiles != null || owned.peakLongRunMiles != null;
  if (hasBuildMiles || owned.buildToPeakPhase) {
    loaded.build = loaded.build ?? emptyBuild();
    if (owned.entryLongRunMiles != null) loaded.build.startLongRunMiles = owned.entryLongRunMiles;
    if (owned.peakLongRunMiles != null) loaded.build.peakLongRunMiles = owned.peakLongRunMiles;
    if (owned.buildToPeakPhase) applyConfigs(loaded.build, owned.buildToPeakPhase);
  }

  const baseMax = owned.baseWeeklyMaxMiles ?? owned.baseEndWeeklyMiles;
  const hasBaseMiles =
    baseMax != null ||
    owned.baseWeeklyMinMiles != null ||
    owned.baseStartLongRunMiles != null ||
    owned.baseEndLongRunMiles != null;
  if (hasBaseMiles || owned.baseBuildPhase) {
    loaded.baseBuild = loaded.baseBuild ?? emptyBuild();
    if (owned.baseStartLongRunMiles != null) loaded.baseBuild.startLongRunMiles = owned.baseStartLongRunMiles;
    if (owned.baseEndLongRunMiles != null) loaded.baseBuild.peakLongRunMiles = owned.baseEndLongRunMiles;
    if (baseMax != null) loaded.baseBuild.peakWeeklyMiles = baseMax;
    if (owned.baseWeeklyMinMiles != null) loaded.baseBuild.weeklyMinMiles = owned.baseWeeklyMinMiles;
    if (owned.baseBuildPhase) applyConfigs(loaded.baseBuild, owned.baseBuildPhase);
  }

  overlayTaperWeeks(loaded, owned);
  overlayRaceWeekMiles(loaded, owned.raceWeekDayMiles);
  loaded.raceWeekMiles = owned.raceWeekMiles;
  return loaded;
}
