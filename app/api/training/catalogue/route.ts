export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import { bodyToCatalogueRow } from "@/lib/training/catalogue-row";
import { generateCatalogueSlug } from "@/lib/training/catalogue-slug";

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const items = await prisma.workout_catalogue.findMany({
      orderBy: [{ workoutType: "asc" }, { progressionIndex: "asc" }],
    });
    return NextResponse.json({ success: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/catalogue", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = bodyToCatalogueRow(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const d = parsed.data;
    const now = new Date();
    const item = await prisma.workout_catalogue.create({
      data: {
        id: newEntityId(),
        name: d.name,
        slug: d.slug ?? generateCatalogueSlug(d.name),
        description: d.description,
        workoutType: d.workoutType,
        intendedPhase: d.intendedPhase,
        isQuality: d.isQuality,
        isLongRunQuality: d.isLongRunQuality,
        isLadder: d.isLadder,
        paceAnchor: d.paceAnchor,
        mpFraction: d.mpFraction,
        mpBlockPosition: d.mpBlockPosition,
        mpBlockProgression: d.mpBlockProgression,
        ladderStepMeters: d.ladderStepMeters,
        minLadderMeters: d.minLadderMeters,
        maxLadderMeters: d.maxLadderMeters,
        progressionIndex: d.progressionIndex,
        workBaseReps: d.workBaseReps,
        workBaseRepMeters: d.workBaseRepMeters,
        recoveryDistanceMeters: d.recoveryDistanceMeters,
        warmupMiles: d.warmupMiles,
        warmupPaceOffsetSecPerMile: d.warmupPaceOffsetSecPerMile,
        cooldownMiles: d.cooldownMiles,
        cooldownPaceOffsetSecPerMile: d.cooldownPaceOffsetSecPerMile,
        workBaseMiles: d.workBaseMiles,
        workPaceOffsetSecPerMile: d.workPaceOffsetSecPerMile,
        workBasePaceOffsetSecPerMile: d.workBasePaceOffsetSecPerMile,
        recoveryPaceOffsetSecPerMile: d.recoveryPaceOffsetSecPerMile,
        isMP: d.isMP,
        mpTotalMiles: d.mpTotalMiles,
        mpPaceOffsetSecPerMile: d.mpPaceOffsetSecPerMile,
        intendedHeartRateZone: d.intendedHeartRateZone,
        intendedHRBpmLow: d.intendedHRBpmLow,
        intendedHRBpmHigh: d.intendedHRBpmHigh,
        notes: d.notes,
        updatedAt: now,
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/catalogue", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
