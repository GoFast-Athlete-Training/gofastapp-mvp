export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import { bodyToCatalogueRow } from "@/lib/training/catalogue-row";

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
        workoutType: d.workoutType,
        intendedPhase: d.intendedPhase,
        progressionIndex: d.progressionIndex,
        reps: d.reps,
        repDistanceMeters: d.repDistanceMeters,
        recoveryDistanceMeters: d.recoveryDistanceMeters,
        warmupMiles: d.warmupMiles,
        cooldownMiles: d.cooldownMiles,
        repPaceOffsetSecPerMile: d.repPaceOffsetSecPerMile,
        recoveryPaceOffsetSecPerMile: d.recoveryPaceOffsetSecPerMile,
        overallPaceOffsetSecPerMile: d.overallPaceOffsetSecPerMile,
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
