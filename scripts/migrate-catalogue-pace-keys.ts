/**
 * Data migration: add paceKey to workout_catalogue segmentPaceDist rows that only have
 * paceOffsetSecPerMile. Offsets remain as legacy fallbacks.
 *
 * Dry run (default): logs counts only.
 * Apply: npm run db:migrate-catalogue-pace-keys -- --apply
 */

import type { Prisma, WorkoutType } from "@prisma/client";
import { prisma } from "../lib/prisma";

const CANONICAL_KEYS = new Set([
  "relaxed",
  "easy",
  "steady",
  "moderate",
  "threshold",
  "fiveKPace",
  "tenKPace",
  "marathonPace",
  "recoveryJog",
]);

function inferPaceKey(
  offset: number,
  workoutType: WorkoutType,
  opts: { isRecovery?: boolean; segmentIndex?: number; segmentCount?: number } = {}
): string {
  if (opts.isRecovery || offset >= 150) return "recoveryJog";
  if (offset >= 120) return "easy";
  if (offset >= 90) return "steady";
  if (offset >= 60) return "moderate";
  if (offset >= 25) return "threshold";
  if (offset >= 0 && offset < 15) {
    if (workoutType === "Tempo") return "threshold";
    if (workoutType === "LongRun" && opts.segmentCount != null && opts.segmentCount > 1) {
      const i = opts.segmentIndex ?? 0;
      const last = opts.segmentCount - 1;
      if (i === last) return "marathonPace";
      if (i === 0) return "steady";
      return "moderate";
    }
    return "fiveKPace";
  }
  return "steady";
}

type SegRow = Record<string, unknown>;

function migrateSegmentArray(
  raw: unknown,
  workoutType: WorkoutType
): { next: SegRow[]; changed: number } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  let changed = 0;
  const next = raw.map((item, index) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return item as SegRow;
    const row = { ...(item as SegRow) };
    const existingKey = typeof row.paceKey === "string" ? row.paceKey.trim() : "";
    if (existingKey && CANONICAL_KEYS.has(existingKey)) return row;

    const offRaw = row.paceOffsetSecPerMile;
    const offset =
      typeof offRaw === "number" && Number.isFinite(offRaw)
        ? offRaw
        : typeof offRaw === "string" && offRaw.trim() !== ""
          ? Number(offRaw)
          : NaN;
    if (!Number.isFinite(offset)) return row;

    const isRecovery =
      row.kind === "recovery" ||
      row.segmentRole === "recovery" ||
      (typeof row.label === "string" && row.label.toLowerCase().includes("recovery"));

    row.paceKey = inferPaceKey(offset, workoutType, {
      isRecovery,
      segmentIndex: index,
      segmentCount: raw.length,
    });
    changed++;
    return row;
  });
  return { next, changed };
}

function migrateSegmentPaceDist(
  raw: unknown,
  workoutType: WorkoutType
): { next: Prisma.InputJsonValue; changed: number } | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const result = migrateSegmentArray(raw, workoutType);
    if (!result || result.changed === 0) return null;
    return { next: result.next as Prisma.InputJsonValue, changed: result.changed };
  }

  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  let totalChanged = 0;
  const out: Record<string, unknown> = { ...o };

  for (const key of ["segments", "workSegments", "milesSegments", "repGroups"] as const) {
    if (!(key in o)) continue;
    const result = migrateSegmentArray(o[key], workoutType);
    if (result && result.changed > 0) {
      out[key] = result.next;
      totalChanged += result.changed;
    }
  }

  if (totalChanged === 0) return null;
  return { next: out as Prisma.InputJsonValue, changed: totalChanged };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.workout_catalogue.findMany({
    select: { id: true, name: true, workoutType: true, segmentPaceDist: true },
  });

  let rowsTouched = 0;
  let segmentsTagged = 0;

  for (const row of rows) {
    const migrated = migrateSegmentPaceDist(row.segmentPaceDist, row.workoutType);
    if (!migrated) continue;
    rowsTouched++;
    segmentsTagged += migrated.changed;
    console.log(
      `[catalogue-pace-keys] ${apply ? "UPDATE" : "DRY-RUN"} ${row.name} (${row.workoutType}): +${migrated.changed} paceKey(s)`
    );
    if (apply) {
      await prisma.workout_catalogue.update({
        where: { id: row.id },
        data: { segmentPaceDist: migrated.next },
      });
    }
  }

  console.log(
    `[catalogue-pace-keys] ${apply ? "Applied" : "Would update"} ${rowsTouched} catalogue row(s), ${segmentsTagged} segment(s) tagged.`
  );
  if (!apply && rowsTouched > 0) {
    console.log("[catalogue-pace-keys] Re-run with --apply to persist.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
