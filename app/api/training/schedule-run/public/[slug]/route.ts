export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeEstimatedFinishLabel } from "@/lib/training/schedule-run-estimated-finish";

function normalizeSlug(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * GET /api/training/schedule-run/public/[slug]
 * Public payload for /join/scheduled-run/[slug].
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

    const row = await prisma.scheduled_runs.findFirst({
      where: { shareSlug: slug },
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

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const estimatedFinishLabel = computeEstimatedFinishLabel({
      startTimeLabel: row.startTimeLabel,
      estimatedDistanceMi: row.estimatedDistanceMi,
      fiveKPace: row.Athlete?.fiveKPace ?? null,
    });

    return NextResponse.json({
      success: true,
      scheduledRun: {
        id: row.id,
        title: row.title,
        date: row.date.toISOString(),
        startTimeLabel: row.startTimeLabel,
        estimatedFinishLabel,
        estimatedDistanceMi: row.estimatedDistanceMi,
        isTrack: row.isTrack,
        stravaRouteUrl: row.stravaRouteUrl,
        meetupLocation: row.meetupLocation,
        routeDescription: row.routeDescription,
        shareSlug: row.shareSlug,
      },
      athlete: row.Athlete
        ? {
            firstName: row.Athlete.firstName,
            lastName: row.Athlete.lastName,
            gofastHandle: row.Athlete.gofastHandle,
            photoURL: row.Athlete.photoURL,
            city: row.Athlete.city,
            state: row.Athlete.state,
          }
        : null,
    });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run/public/[slug]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
