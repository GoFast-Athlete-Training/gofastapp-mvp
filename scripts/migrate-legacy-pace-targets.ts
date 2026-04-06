/**
 * Data migration: set workout_segments.paceTargetEncodingVersion = 2 for all rows.
 *
 * - Rows at version 1: PACE numbers in targets are legacy inflated storage; rewrite to
 *   true sec/km using the same rule as paceTargetStoredToGarminSecPerKm(..., 1).
 * - Rows at any other non-2 value: only bump the column to 2 (do not rewrite JSON).
 *
 * Run against your DB (DATABASE_URL in env):
 *   npm run db:migrate-pace-targets
 *
 * Safe to re-run: rows already at v2 are skipped.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { paceTargetStoredToGarminSecPerKm } from "../lib/workout-generator/pace-calculator";

function normalizeV1TargetsJson(targets: unknown): {
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
        nextObj[k] = paceTargetStoredToGarminSecPerKm(v, 1);
      }
    }
    return nextObj;
  });
  return { next: out as Prisma.InputJsonValue, touchedPace };
}

async function main(): Promise<void> {
  const rows = await prisma.workout_segments.findMany({
    where: { NOT: { paceTargetEncodingVersion: 2 } },
    select: {
      id: true,
      targets: true,
      paceTargetEncodingVersion: true,
    },
  });

  let updated = 0;
  let paceFieldsRewritten = 0;

  for (const row of rows) {
    const wasV1 = row.paceTargetEncodingVersion === 1;
    const data: Prisma.workout_segmentsUpdateInput = {
      paceTargetEncodingVersion: 2,
    };

    if (wasV1) {
      const norm = normalizeV1TargetsJson(row.targets);
      if (norm?.touchedPace) {
        data.targets = norm.next;
        paceFieldsRewritten++;
      }
    }

    await prisma.workout_segments.update({
      where: { id: row.id },
      data,
    });
    updated++;
  }

  console.log(
    `[migrate-legacy-pace-targets] Updated ${updated} segment row(s) to encoding v2` +
      (paceFieldsRewritten
        ? ` (rewrote PACE numbers on ${paceFieldsRewritten} row(s) from legacy v1 storage).`
        : ".")
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
