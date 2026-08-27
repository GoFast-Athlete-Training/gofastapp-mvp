/**
 * Join athlete ordering overlays onto shared catalog positions for API / generation.
 */

import type {
  LoadedAthletePresetInclude,
  LoadedPresetInclude,
} from "@/lib/training/plan-generate-presets-loader";

type PositionWithCatalogue = {
  id: string;
  cyclePosition: number;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
  workout_catalogue?: unknown;
};

export type ResolvedAthleteRotations = {
  longRunConfig: LoadedAthletePresetInclude["longRunConfig"];
  easyConfig: LoadedAthletePresetInclude["easyConfig"];
  tempoConfig: LoadedPresetInclude["tempoConfig"];
  intervalsConfig: LoadedPresetInclude["intervalsConfig"];
};

function applyOrder<T extends PositionWithCatalogue>(
  catalogPositions: T[],
  orderRows: Array<{ cyclePosition: number; positionId: string }>,
  getPositionId: (p: T) => string
): T[] {
  if (orderRows.length === 0) {
    return [...catalogPositions].sort((a, b) => a.cyclePosition - b.cyclePosition);
  }
  const byId = new Map(catalogPositions.map((p) => [getPositionId(p), p]));
  return orderRows
    .slice()
    .sort((a, b) => a.cyclePosition - b.cyclePosition)
    .map((row, idx) => {
      const src = byId.get(row.positionId);
      if (!src) return null;
      return { ...src, cyclePosition: idx + 1 };
    })
    .filter((p): p is T => p != null);
}

function athleteLaneAsCatalogConfig(
  positions: Array<{
    id: string;
    cyclePosition: number;
    distributionWeight: number;
    catalogueWorkoutId: string | null;
    workout_catalogue?: unknown;
  }> | undefined,
  name: string
): LoadedPresetInclude["tempoConfig"] {
  if (!positions?.length) return null;
  return {
    id: name,
    name,
    description: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    positions: positions.map((p) => ({
      id: p.id,
      cyclePosition: p.cyclePosition,
      distributionWeight: p.distributionWeight,
      catalogueWorkoutId: p.catalogueWorkoutId,
      workout_catalogue: p.workout_catalogue ?? null,
    })),
  } as LoadedPresetInclude["tempoConfig"];
}

export function resolveAthletePresetRotations(
  row: LoadedAthletePresetInclude & {
    longRunOrders?: Array<{
      cyclePosition: number;
      longRunConfigPositionId: string;
    }>;
    easyOrders?: Array<{ cyclePosition: number; easyConfigPositionId: string }>;
    athleteTempoConfig?: {
      positions: Array<{
        id: string;
        cyclePosition: number;
        distributionWeight: number;
        catalogueWorkoutId: string | null;
        workout_catalogue?: unknown;
      }>;
    } | null;
    athleteIntervalsConfig?: {
      positions: Array<{
        id: string;
        cyclePosition: number;
        distributionWeight: number;
        catalogueWorkoutId: string | null;
        workout_catalogue?: unknown;
      }>;
    } | null;
  }
): ResolvedAthleteRotations {
  const lrPositions = applyOrder(
    row.longRunConfig?.positions ?? [],
    (row.longRunOrders ?? []).map((o) => ({
      cyclePosition: o.cyclePosition,
      positionId: o.longRunConfigPositionId,
    })),
    (p) => p.id
  );

  const easyPositions = applyOrder(
    row.easyConfig?.positions ?? [],
    (row.easyOrders ?? []).map((o) => ({
      cyclePosition: o.cyclePosition,
      positionId: o.easyConfigPositionId,
    })),
    (p) => p.id
  );

  const longRunConfig = row.longRunConfig
    ? { ...row.longRunConfig, positions: lrPositions }
    : null;
  const easyConfig = row.easyConfig
    ? { ...row.easyConfig, positions: easyPositions }
    : null;

  const tempoConfig = athleteLaneAsCatalogConfig(
    row.athleteTempoConfig?.positions,
    "Athlete tempo"
  );
  const intervalsConfig = athleteLaneAsCatalogConfig(
    row.athleteIntervalsConfig?.positions,
    "Athlete intervals"
  ) as LoadedPresetInclude["intervalsConfig"];

  return { longRunConfig, easyConfig, tempoConfig, intervalsConfig };
}
