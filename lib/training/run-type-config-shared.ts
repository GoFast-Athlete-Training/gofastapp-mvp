/** Shared preset position shape consumed by generators (no Prisma coupling). */

import type { WorkoutType } from "@prisma/client";

export type RunTypePosition = {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
  distributionWeight?: number;
};

export type RunTypeConfigInput = {
  workoutType: WorkoutType;
  positions: RunTypePosition[];
};

export function catalogueIdForRotation(
  positions: readonly RunTypePosition[],
  cycleIndex: number,
): string | null {
  const sorted = [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition);
  if (sorted.length === 0) return null;
  const slot = sorted[cycleIndex % sorted.length];
  return slot?.catalogueWorkoutId?.trim() || null;
}

export function runTypeConfigPositionsToInputs(
  workoutType: WorkoutType,
  positions: Array<{
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }>
): RunTypeConfigInput[] {
  if (positions.length === 0) return [];
  const pos = positions.map((p) => ({
    cyclePosition: p.cyclePosition,
    catalogueWorkoutId: p.catalogueWorkoutId,
    distributionWeight: p.distributionWeight,
  }));
  return [{ workoutType, positions: pos }];
}
