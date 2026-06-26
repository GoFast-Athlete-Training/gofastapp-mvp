export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { workoutToScheduleRunRow } from "@/lib/training/schedule-run-workout";

type Ctx = { params: Promise<{ id: string }> };

function shareUrlForSlug(slug: string, request: NextRequest): string {
  const origin =
    request.headers.get("x-forwarded-host") != null
      ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;
  return `${origin}/join/scheduled-run/${slug}`;
}

/**
 * GET /api/training/schedule-run/[id]
 * id is the workout id.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;
    const { id } = await params;

    const row = await prisma.workouts.findFirst({
      where: { id, athleteId: athlete.id },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const mapped = workoutToScheduleRunRow(row);
    if (!mapped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      scheduledRun: {
        ...mapped,
        date: mapped.date.toISOString(),
        createdAt: mapped.createdAt.toISOString(),
        updatedAt: mapped.updatedAt.toISOString(),
        shareUrl: mapped.shareSlug ? shareUrlForSlug(mapped.shareSlug, request) : null,
        joinPath: mapped.shareSlug ? `/join/scheduled-run/${mapped.shareSlug}` : null,
      },
    });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/training/schedule-run/[id]
 * Clears schedule fields on plan workouts; deletes standalone scheduled workouts.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;
    const { id } = await params;

    const row = await prisma.workouts.findFirst({
      where: { id, athleteId: athlete.id },
      select: { id: true, planId: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.planId) {
      await prisma.workouts.update({
        where: { id },
        data: {
          scheduledStartTimeLabel: null,
          scheduledMeetupLocation: null,
          scheduledRouteDescription: null,
          scheduledStravaRouteUrl: null,
          scheduledIsTrack: false,
          scheduledShareSlug: null,
        },
      });
    } else {
      await prisma.workouts.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("DELETE /api/training/schedule-run/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
