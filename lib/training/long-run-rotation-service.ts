import type { WorkoutType } from "@prisma/client";

/**
 * Slug contract for 4-position long-run rotation: static, progressive, MP, static (cutback).
 * Positions 0 and 3 use the static entry; 1 = progressive, 2 = MP.
 */
export const LR_SLUGS = {
  static: "long-run-static",
  progressive: "long-run-progressive",
  mp: "long-run-mp",
} as const;

export type CatalogueRowWithSlug = {
  id: string;
  workoutType: WorkoutType;
  slug: string | null;
};

function slugForCyclePos(cyclePos: number): string | null {
  if (cyclePos === 0 || cyclePos === 3) return LR_SLUGS.static;
  if (cyclePos === 1) return LR_SLUGS.progressive;
  if (cyclePos === 2) return LR_SLUGS.mp;
  return null;
}

/**
 * Picks a long-run catalogue row by `slug` for the 4-position rotation. Returns null if missing.
 */
export function pickLongRunCatalogueBySlug(
  cyclePos: number,
  rows: readonly CatalogueRowWithSlug[]
): CatalogueRowWithSlug | null {
  const target = slugForCyclePos(cyclePos);
  if (!target) return null;
  return (
    rows.find((w) => w.workoutType === "LongRun" && w.slug === target) ?? null
  );
}
