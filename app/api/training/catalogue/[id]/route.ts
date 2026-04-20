export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { bodyToCatalogueRow } from "@/lib/training/catalogue-row";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = bodyToCatalogueRow(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const d = parsed.data;
    const now = new Date();
    const item = await prisma.workout_catalogue.update({
      where: { id },
      data: {
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
    console.error("PUT /api/training/catalogue/[id]", e);
    if (String(msg).includes("Record to update not found")) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  try {
    await prisma.workout_catalogue.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/training/catalogue/[id]", e);
    if (String(msg).includes("Record to delete does not exist")) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
