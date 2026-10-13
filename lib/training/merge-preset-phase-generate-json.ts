import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import { parseRaceWeekSlots } from "@/lib/training/race-week-slots";
import {
  phaseWeekRowsFromLegacyTaper,
  presetTaperHasVolumeCaps,
} from "@/lib/training/phase-week-pins";
import { parseTaperWeekSlots } from "@/lib/training/taper-week-slots";

function mapRotationFromJson(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" ? o.name : null;
  const positionsRaw = o.positions;
  if (!id || !name || !Array.isArray(positionsRaw)) return null;
  const positions = positionsRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const po = p as Record<string, unknown>;
      return {
        cyclePosition: Number(po.cyclePosition),
        catalogueWorkoutId:
          typeof po.catalogueWorkoutId === "string" ? po.catalogueWorkoutId : null,
        distributionWeight: Number(po.distributionWeight) || 0.25,
      };
    })
    .filter(Boolean) as {
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }[];
  return { id, name, positions };
}

function buildFromJson(raw: unknown): TrainingManagePresetForGenerate["build"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    startLongRunMiles: typeof o.startLongRunMiles === "number" ? o.startLongRunMiles : null,
    peakLongRunMiles: typeof o.peakLongRunMiles === "number" ? o.peakLongRunMiles : null,
    peakWeeklyMiles: typeof o.peakWeeklyMiles === "number" ? o.peakWeeklyMiles : null,
    longRunCutback: typeof o.longRunCutback === "number" ? o.longRunCutback : null,
    longRunConfigId: typeof o.longRunConfigId === "string" ? o.longRunConfigId : null,
    easyConfigId: typeof o.easyConfigId === "string" ? o.easyConfigId : null,
    tempoConfigId: typeof o.tempoConfigId === "string" ? o.tempoConfigId : null,
    intervalsConfigId: typeof o.intervalsConfigId === "string" ? o.intervalsConfigId : null,
    longRunConfig: mapRotationFromJson(o.longRunConfig),
    easyConfig: mapRotationFromJson(o.easyConfig),
    tempoConfig: mapRotationFromJson(o.tempoConfig),
    intervalsConfig: mapRotationFromJson(o.intervalsConfig),
  };
}

function taperFromJson(raw: unknown): TrainingManagePresetForGenerate["taper"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "Taper";
  const weeks = Array.isArray(o.weeks)
    ? phaseWeekRowsFromLegacyTaper({ week1TotalMiles: null, week1LongRunMiles: null, week2TotalMiles: null, week2LongRunMiles: null, weeks: o.weeks as never })
    : phaseWeekRowsFromLegacyTaper({
        week1TotalMiles: typeof o.week1TotalMiles === "number" ? o.week1TotalMiles : null,
        week1LongRunMiles: typeof o.week1LongRunMiles === "number" ? o.week1LongRunMiles : null,
        week2TotalMiles: typeof o.week2TotalMiles === "number" ? o.week2TotalMiles : null,
        week2LongRunMiles: typeof o.week2LongRunMiles === "number" ? o.week2LongRunMiles : null,
        weekPins: o.weekPins,
      });
  const slots = parseTaperWeekSlots(o.slots);
  return { name, weeks, slots: slots.length > 0 ? slots : undefined };
}

function raceWeekFromJson(raw: unknown): TrainingManagePresetForGenerate["raceWeek"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "Race week";
  const slots = parseRaceWeekSlots(o.slots);
  if (!slots.length) return null;
  return { title, slots };
}

/** Overlay stale mirror relations with prodpush snapshot JSON when needed. */
export function mergePresetWithPhaseGenerateJson(
  loaded: TrainingManagePresetForGenerate,
  json: unknown,
): TrainingManagePresetForGenerate {
  if (!json || typeof json !== "object") return loaded;
  const snap = json as Record<string, unknown>;

  const jsonBuild = buildFromJson(snap.build);
  const jsonTaper = taperFromJson(snap.taper);
  const jsonRaceWeek = raceWeekFromJson(snap.raceWeek);

  const build =
    loaded.build?.longRunConfig?.positions?.length
      ? loaded.build
      : jsonBuild ?? loaded.build;

  const loadedTaperCaps = presetTaperHasVolumeCaps(loaded.taper?.weeks);
  const taper =
    loaded.taper && (loadedTaperCaps || (loaded.taper.weeks?.length ?? 0) > 0)
      ? {
          ...loaded.taper,
          slots:
            loaded.taper.slots?.length
              ? loaded.taper.slots
              : jsonTaper?.slots,
        }
      : jsonTaper ?? loaded.taper;

  const raceWeek =
    loaded.raceWeek?.slots?.length ? loaded.raceWeek : jsonRaceWeek ?? loaded.raceWeek;

  return {
    ...loaded,
    build,
    taper,
    raceWeek,
  };
}
