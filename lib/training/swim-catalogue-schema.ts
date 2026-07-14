/**
 * Swim workout catalogue and rotation config JSON shapes.
 * DB tables: swim_workout_catalogue, swim_rotation_config, swim_rotation_config_position.
 */

import type { SwimWorkoutType } from "@prisma/client";
import { isSwimWorkoutType, type SwimWorkoutTypeKey } from "@/lib/training/swim-plan-preset";

export type SwimCatalogueSegment = {
  label?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  paceOffsetSecPer100m?: number;
  strokeType?: string;
  equipment?: string;
  restSeconds?: number;
  repeatCount?: number;
};

export type SwimCatalogueSegmentPattern = {
  warmup?: SwimCatalogueSegment[];
  main?: SwimCatalogueSegment[];
  cooldown?: SwimCatalogueSegment[];
};

export type SwimWorkoutCatalogueSnapshot = {
  id: string;
  name: string;
  slug?: string | null;
  workoutType: SwimWorkoutType;
  description?: string | null;
  totalWorkDistanceMeters?: number | null;
  repDistanceMeters?: number | null;
  repCount?: number | null;
  recoverySeconds?: number | null;
  recoveryMeters?: number | null;
  warmupMeters?: number | null;
  cooldownMeters?: number | null;
  paceOffsetSecPer100m?: number | null;
  segmentPattern?: SwimCatalogueSegmentPattern | null;
  trainingIntent?: string[];
};

export type SwimRotationPositionInput = {
  cyclePosition: number;
  distributionWeight?: number;
  catalogueWorkoutId: string | null;
};

export type SwimRotationConfigInput = {
  name: string;
  description?: string | null;
  workoutType: SwimWorkoutTypeKey;
  positions: SwimRotationPositionInput[];
};

export function parseSwimCatalogueSegmentPattern(
  raw: unknown
): SwimCatalogueSegmentPattern | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  function parseSegments(key: "warmup" | "main" | "cooldown"): SwimCatalogueSegment[] | undefined {
    const arr = o[key];
    if (!Array.isArray(arr)) return undefined;
    const out: SwimCatalogueSegment[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const seg = item as Record<string, unknown>;
      out.push({
        label: typeof seg.label === "string" ? seg.label : undefined,
        distanceMeters:
          typeof seg.distanceMeters === "number" ? Math.round(seg.distanceMeters) : undefined,
        durationSeconds:
          typeof seg.durationSeconds === "number"
            ? Math.round(seg.durationSeconds)
            : undefined,
        paceOffsetSecPer100m:
          typeof seg.paceOffsetSecPer100m === "number"
            ? Math.round(seg.paceOffsetSecPer100m)
            : undefined,
        strokeType: typeof seg.strokeType === "string" ? seg.strokeType : undefined,
        equipment: typeof seg.equipment === "string" ? seg.equipment : undefined,
        restSeconds:
          typeof seg.restSeconds === "number" ? Math.round(seg.restSeconds) : undefined,
        repeatCount:
          typeof seg.repeatCount === "number" ? Math.round(seg.repeatCount) : undefined,
      });
    }
    return out.length > 0 ? out : undefined;
  }

  const pattern: SwimCatalogueSegmentPattern = {
    warmup: parseSegments("warmup"),
    main: parseSegments("main"),
    cooldown: parseSegments("cooldown"),
  };

  if (!pattern.warmup && !pattern.main && !pattern.cooldown) return null;
  return pattern;
}

export function assertSwimRotationPositions(
  positions: SwimRotationPositionInput[],
  expectedWorkoutType: SwimWorkoutTypeKey,
  configLabel: string
): { ok: true } | { ok: false; error: string } {
  if (positions.length === 0) {
    return {
      ok: false,
      error: `${configLabel} requires at least one rotation slot.`,
    };
  }
  for (let i = 0; i < positions.length; i++) {
    const row = positions[i]!;
    if (!row.catalogueWorkoutId?.trim()) {
      return {
        ok: false,
        error: `${configLabel} slot ${i + 1} is missing a catalogue workout.`,
      };
    }
    if (!Number.isInteger(row.cyclePosition) || row.cyclePosition < 1) {
      return {
        ok: false,
        error: `${configLabel} slot ${i + 1} has invalid cyclePosition.`,
      };
    }
  }
  if (!isSwimWorkoutType(expectedWorkoutType)) {
    return { ok: false, error: `${configLabel} has invalid workout type.` };
  }
  return { ok: true };
}

// TODO(phase-2): staff catalogue CRUD + mutation scripts mirroring run workout_catalogue tooling.
// TODO(phase-2): validate catalogue workoutType matches parent rotation config workoutType on save.
