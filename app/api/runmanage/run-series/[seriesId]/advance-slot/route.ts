import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertRunManageAuth,
  staffGeneratedIdFromAuth,
} from "@/lib/runmanage/require-run-manage-auth";
import { duplicateRunForward } from "@/lib/advance-club-instances";
import { dateKeyToUtcStartOfDay } from "@/lib/calendar-date";

export const dynamic = "force-dynamic";

/**
 * POST /api/runmanage/run-series/[seriesId]/advance-slot
 * Body: { targetDateYmd: string }
 * Reuse last prior city_run onto target date (unpublished, no route).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { seriesId } = await params;

  let body: { targetDateYmd?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const targetDateYmd = body.targetDateYmd?.trim();
  if (!targetDateYmd) {
    return NextResponse.json(
      { success: false, error: "targetDateYmd is required" },
      { status: 400 }
    );
  }

  const start = dateKeyToUtcStartOfDay(targetDateYmd);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const existing = await prisma.city_runs.findFirst({
    where: {
      runSeriesId: seriesId,
      date: { gte: start, lt: end },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      outcome: "found_existing",
      runId: existing.id,
    });
  }

  const prior = await prisma.city_runs.findFirst({
    where: {
      runSeriesId: seriesId,
      date: { lt: start },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      date: true,
      published: true,
      workflowStatus: true,
      runSeriesId: true,
      runClubId: true,
      citySlug: true,
      regionSlug: true,
      slug: true,
      dayOfWeek: true,
      timezone: true,
      meetUpPoint: true,
      meetUpStreetAddress: true,
      meetUpCity: true,
      meetUpState: true,
      meetUpZip: true,
      meetUpPlaceId: true,
      meetUpLat: true,
      meetUpLng: true,
      endPoint: true,
      endStreetAddress: true,
      endCity: true,
      endState: true,
      totalMiles: true,
      pace: true,
      stravaMapUrl: true,
      stravaEventUrl: true,
      stravaText: true,
      webUrl: true,
      webText: true,
      igPostText: true,
      igPostGraphic: true,
      description: true,
      postRunActivity: true,
      routePhotos: true,
      mapImageUrl: true,
      staffNotes: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      routeNeighborhood: true,
      runType: true,
      workoutDescription: true,
      directionsText: true,
      routeNotes: true,
      routeId: true,
      plannedWorkoutId: true,
      cityRunType: true,
      staffGeneratedId: true,
    },
  });

  if (!prior) {
    return NextResponse.json(
      { success: false, error: "No prior run to reuse for this series" },
      { status: 400 }
    );
  }

  try {
    const staffGeneratedId = staffGeneratedIdFromAuth(auth);
    const created = await duplicateRunForward(prior, targetDateYmd, staffGeneratedId, false);
    return NextResponse.json({
      success: true,
      outcome: "created",
      runId: created.id,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[POST advance-slot]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Advance slot failed" },
      { status: 500 }
    );
  }
}
