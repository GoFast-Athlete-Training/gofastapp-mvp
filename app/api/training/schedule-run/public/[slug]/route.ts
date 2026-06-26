export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEstimatedFinishLabel } from "@/lib/training/schedule-run-estimated-finish";
import { workoutToScheduleRunRow } from "@/lib/training/schedule-run-workout";

function normalizeSlug(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function metersToMi(meters: number | null | undefined): number | null {
  if (meters == null || meters <= 0) return null;
  return Math.round((meters / 1609.34) * 10) / 10;
}

/**
 * GET /api/training/schedule-run/public/[slug]
 * Public payload for /join/scheduled-run/[slug] — backed by workouts.scheduledShareSlug.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await params;
    const slug = normalizeSlug(raw || "");
    if (!slug) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workout = await prisma.workouts.findFirst({
      where: { scheduledShareSlug: slug },
      include: {
        Athlete: {
          select: {
            firstName: true,
            lastName: true,
            gofastHandle: true,
            photoURL: true,
            city: true,
            state: true,
            fiveKPace: true,
          },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const mapped = workoutToScheduleRunRow(workout);
    if (!mapped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const estimatedFinishLabel = computeEstimatedFinishLabel({
      startTimeLabel: mapped.startTimeLabel,
      estimatedDistanceMi: metersToMi(workout.estimatedDistanceInMeters),
      fiveKPace: workout.Athlete?.fiveKPace ?? null,
    });

    return NextResponse.json({
      success: true,
      scheduledRun: {
        id: mapped.id,
        title: mapped.title,
        date: mapped.date.toISOString(),
        startTimeLabel: mapped.startTimeLabel,
        estimatedFinishLabel,
        estimatedDistanceMi: mapped.estimatedDistanceMi,
        isTrack: mapped.isTrack,
        stravaRouteUrl: mapped.stravaRouteUrl,
        meetupLocation: mapped.meetupLocation,
        routeDescription: mapped.routeDescription,
        shareSlug: mapped.shareSlug,
      },
      athlete: workout.Athlete
        ? {
            firstName: workout.Athlete.firstName,
            lastName: workout.Athlete.lastName,
            gofastHandle: workout.Athlete.gofastHandle,
            photoURL: workout.Athlete.photoURL,
            city: workout.Athlete.city,
            state: workout.Athlete.state,
          }
        : null,
    });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run/public/[slug]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
