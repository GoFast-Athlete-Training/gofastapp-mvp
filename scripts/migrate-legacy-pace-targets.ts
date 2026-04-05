/**
 * One-time: normalize workout_segments.targets PACE values from legacy storage
 * (sec/mile × km/mi) to true sec/km, and set paceTargetEncodingVersion = 2.
 *
 * Run after prisma migrate deploy adds the column (existing rows start at version 1):
 *   npm run db:migrate-pace-targets
 *
 * Safe to re-run only if rows remain at version 1; do not run after segments are v2.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { LEGACY_PACE_TARGET_STORAGE_FACTOR } from "../lib/workout-generator/pace-calculator";

function normalizeTargetsJson(targets: unknown): {
  next: Prisma.InputJsonValue;
  touchedPace: boolean;
} | null {
  if (targets == null) return null;
  if (!Array.isArray(targets)) return null;
  let touchedPace = false;
  const out = targets.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const o = entry as Record<string, unknown>;
    if (String(o.type || "").toUpperCase() !== "PACE") return entry;
    touchedPace = true;
    const nextObj = { ...o };
    for (const k of ["value", "valueLow", "valueHigh"] as const) {
      const v = nextObj[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        nextObj[k] = Math.round(v / LEGACY_PACE_TARGET_STORAGE_FACTOR);
      }
    }
    return nextObj;
  });
  return { next: out as Prisma.InputJsonValue, touchedPace };
}

async function main(): Promise<void> {
  const rows = await prisma.workout_segments.findMany({
    where: { paceTargetEncodingVersion: 1 },
    select: { id: true, targets: true },
  });

  let updated = 0;
  for (const row of rows) {
    const norm = normalizeTargetsJson(row.targets);
    const data: Prisma.workout_segmentsUpdateInput = {
      paceTargetEncodingVersion: 2,
    };
    if (norm?.touchedPace) {
      data.targets = norm.next;
    }
    await prisma.workout_segments.update({
      where: { id: row.id },
      data,
    });
    updated++;
  }

  console.log(
    `[migrate-legacy-pace-targets] Updated ${updated} segment row(s) to encoding v2.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
