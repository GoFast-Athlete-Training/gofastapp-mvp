export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/workouts/[id]/status
 * Body: { status: "skipped", reason?: string } | { status: "planned" } to undo skip.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;
    const existing = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    if (existing.matchedActivityId) {
      return NextResponse.json(
        { error: "Completed workouts cannot be marked skipped. Unlink the activity first." },
        { status: 400 }
      );
    }

    let body: { status?: string; reason?: string | null };
    try {
      body = (await request.json()) as { status?: string; reason?: string | null };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (status !== "skipped" && status !== "planned") {
      return NextResponse.json(
        { error: 'status must be "skipped" or "planned"' },
        { status: 400 }
      );
    }

    let skipReason: string | null = null;
    if (status === "skipped") {
      if ("reason" in body) {
        if (body.reason === null || body.reason === "") {
          skipReason = null;
        } else if (typeof body.reason === "string") {
          skipReason = body.reason.trim().slice(0, 500) || null;
        } else {
          return NextResponse.json({ error: "reason must be a string or null" }, { status: 400 });
        }
      }
    }

    const updated = await prisma.workouts.update({
      where: { id: existing.id },
      data:
        status === "skipped"
          ? {
              skippedAt: new Date(),
              skipReason,
              updatedAt: new Date(),
            }
          : {
              skippedAt: null,
              skipReason: null,
              updatedAt: new Date(),
            },
    });

    return NextResponse.json({
      success: true,
      workout: {
        id: updated.id,
        skippedAt: updated.skippedAt?.toISOString() ?? null,
        skipReason: updated.skipReason ?? null,
        matchedActivityId: updated.matchedActivityId,
      },
    });
  } catch (error: unknown) {
    console.error("PATCH /api/workouts/[id]/status", error);
    return NextResponse.json({ error: "Failed to update workout status" }, { status: 500 });
  }
}
