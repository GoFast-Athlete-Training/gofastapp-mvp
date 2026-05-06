export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import {
  bodyToCatalogueRow,
  type CatalogueRowInput,
} from "@/lib/training/catalogue-row";
import { generateCatalogueSlug } from "@/lib/training/catalogue-slug";

/**
 * POST body: `{ items: Record<string, unknown>[] }`
 *
 * Each element is parsed like a single catalogue upsert: shape matches writable
 * `workout_catalogue` columns (see Prisma). Required per row: **`name`**, **`workoutType`**.
 * Everything else is optional — omit or send `null` for DB nulls. Defaults match Prisma:
 * `paceAnchor` → `currentBuildup`, `mpBlockProgression` → `flat`. Legacy JSON keys
 * (`segmentPatternJson`, `workSegmentsJson`) are accepted where documented in `bodyToCatalogueRow`.
 *
 * Upserts by unique `(name, workoutType)`.
 */
export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { items?: unknown };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    const parsedRows: CatalogueRowInput[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < body.items!.length; i++) {
      const row = body.items![i] as Record<string, unknown>;
      const parsed = bodyToCatalogueRow(row);
      if (!parsed.ok) {
        errors.push({ index: i, error: parsed.error });
      } else {
        parsedRows.push(parsed.data);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: "Validation failed", errors },
        { status: 400 }
      );
    }

    const seen = new Set<string>();
    for (const d of parsedRows) {
      const k = `${d.name}|${d.workoutType}`;
      if (seen.has(k)) {
        return NextResponse.json(
          {
            success: false,
            error: `Duplicate name+workoutType in import: ${d.name} (${d.workoutType})`,
          },
          { status: 400 }
        );
      }
      seen.add(k);
    }

    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      for (const d of parsedRows) {
        const existing = await tx.workout_catalogue.findUnique({
          where: {
            name_workoutType: { name: d.name, workoutType: d.workoutType },
          },
        });
        if (existing) {
          const updateData: Record<string, unknown> = {
            description: d.description,
            runSubType: d.runSubType,
            segmentPaceDist:
              d.segmentPaceDist === null
                ? Prisma.JsonNull
                : (d.segmentPaceDist as Prisma.InputJsonValue),
            warmupFraction: d.warmupFraction,
            workFraction: d.workFraction,
            cooldownFraction: d.cooldownFraction,
            paceAnchor: d.paceAnchor,
            mpFraction: d.mpFraction,
            mpBlockPosition: d.mpBlockPosition,
            mpBlockProgression: d.mpBlockProgression,
            workBaseReps: d.workBaseReps,
            workBaseRepMeters: d.workBaseRepMeters,
            recoveryDistanceMeters: d.recoveryDistanceMeters,
            recoveryDurationSeconds: d.recoveryDurationSeconds,
            warmupMiles: d.warmupMiles,
            warmupPaceOffsetSecPerMile: d.warmupPaceOffsetSecPerMile,
            cooldownMiles: d.cooldownMiles,
            cooldownPaceOffsetSecPerMile: d.cooldownPaceOffsetSecPerMile,
            workBaseMiles: d.workBaseMiles,
            workPaceOffsetSecPerMile: d.workPaceOffsetSecPerMile,
            workBasePaceOffsetSecPerMile: d.workBasePaceOffsetSecPerMile,
            recoveryPaceOffsetSecPerMile: d.recoveryPaceOffsetSecPerMile,
            mpTotalMiles: d.mpTotalMiles,
            mpPaceOffsetSecPerMile: d.mpPaceOffsetSecPerMile,
            intendedHeartRateZone: d.intendedHeartRateZone,
            intendedHRBpmLow: d.intendedHRBpmLow,
            intendedHRBpmHigh: d.intendedHRBpmHigh,
            notes: d.notes,
            updatedAt: now,
          };
          if (d.trainingIntent !== undefined) {
            updateData.trainingIntent = d.trainingIntent;
          }
          if (d.slug !== undefined) {
            updateData.slug = d.slug;
          }
          await tx.workout_catalogue.update({
            where: { id: existing.id },
            data: updateData as object,
          });
          updated++;
        } else {
          await tx.workout_catalogue.create({
            data: {
              id: newEntityId(),
              name: d.name,
              runSubType: d.runSubType,
              slug: d.slug ?? generateCatalogueSlug(d.name),
              description: d.description,
              workoutType: d.workoutType,
              segmentPaceDist:
                d.segmentPaceDist === null
                  ? Prisma.JsonNull
                  : (d.segmentPaceDist as Prisma.InputJsonValue),
              warmupFraction: d.warmupFraction,
              workFraction: d.workFraction,
              cooldownFraction: d.cooldownFraction,
              paceAnchor: d.paceAnchor,
              mpFraction: d.mpFraction,
              mpBlockPosition: d.mpBlockPosition,
              mpBlockProgression: d.mpBlockProgression,
              workBaseReps: d.workBaseReps,
              workBaseRepMeters: d.workBaseRepMeters,
              recoveryDistanceMeters: d.recoveryDistanceMeters,
              recoveryDurationSeconds: d.recoveryDurationSeconds,
              warmupMiles: d.warmupMiles,
              warmupPaceOffsetSecPerMile: d.warmupPaceOffsetSecPerMile,
              cooldownMiles: d.cooldownMiles,
              cooldownPaceOffsetSecPerMile: d.cooldownPaceOffsetSecPerMile,
              workBaseMiles: d.workBaseMiles,
              workPaceOffsetSecPerMile: d.workPaceOffsetSecPerMile,
              workBasePaceOffsetSecPerMile: d.workBasePaceOffsetSecPerMile,
              recoveryPaceOffsetSecPerMile: d.recoveryPaceOffsetSecPerMile,
              mpTotalMiles: d.mpTotalMiles,
              mpPaceOffsetSecPerMile: d.mpPaceOffsetSecPerMile,
              intendedHeartRateZone: d.intendedHeartRateZone,
              intendedHRBpmLow: d.intendedHRBpmLow,
              intendedHRBpmHigh: d.intendedHRBpmHigh,
              notes: d.notes,
              ...(d.trainingIntent !== undefined
                ? { trainingIntent: d.trainingIntent }
                : {}),
              updatedAt: now,
            },
          });
          created++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      created,
      updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/catalogue/bulk", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
