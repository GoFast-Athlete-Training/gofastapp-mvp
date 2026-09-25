import { internalApiHeaders } from "@/lib/internal-api-auth";
import type { PhaseWeekRow } from "@/lib/training/phase-week-pins";

export type PhaseRotationForGenerate = {
  id: string;
  name: string;
  positions: {
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }[];
} | null;

export type TrainingManagePresetForGenerate = {
  id: string;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  build: {
    startLongRunMiles: number | null;
    peakLongRunMiles: number | null;
    peakWeeklyMiles: number | null;
    longRunConfig: PhaseRotationForGenerate;
    easyConfig: PhaseRotationForGenerate;
    tempoConfig: PhaseRotationForGenerate;
    intervalsConfig: PhaseRotationForGenerate;
  };
  taper: {
    name: string;
    weeks: PhaseWeekRow[];
  } | null;
  raceWeek: {
    title: string;
    shakeoutRunConfigId: string | null;
    shakeoutDaysPriorToRace: number;
    weeks: PhaseWeekRow[];
  } | null;
};

function trainingManageBaseUrl(): string | null {
  const base =
    process.env.GOFAST_TRAINING_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_TRAINING_MANAGE_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export async function fetchTrainingManagePresetForGenerate(
  presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  const base = trainingManageBaseUrl();
  if (!base) return null;

  const url = `${base}/api/internal/plan-preset/${encodeURIComponent(presetId)}/for-generate`;
  try {
    const res = await fetch(url, {
      headers: internalApiHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      preset?: TrainingManagePresetForGenerate;
    };
    if (!json.success || !json.preset?.build) return null;
    return json.preset;
  } catch (e) {
    console.warn("[fetchTrainingManagePresetForGenerate]", e);
    return null;
  }
}
