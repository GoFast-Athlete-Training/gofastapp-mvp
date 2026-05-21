export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { assignUniqueScheduledRunShareSlug } from "@/lib/scheduled-run-share-slug";
import { buildStartTimeLabel } from "@/lib/training/schedule-run-estimated-finish";
import { ymdFromDate, utcDateOnly } from "@/lib/training/plan-utils";

function parseDateInput(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shareUrlForSlug(slug: string, request: NextRequest): string {
  const origin =
    request.headers.get("x-forwarded-host") != null
      ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;
  return `${origin}/join/scheduled-run/${slug}`;
}

export type ScheduledRunJson = {
  id: string;
  athleteId: string;
  workoutId: string | null;
  date: string;
  startTimeLabel: string | null;
  title: string;
  estimatedDistanceMi: number | null;
  isTrack: boolean;
  stravaRouteUrl: string | null;
  meetupLocation: string | null;
  routeDescription: string | null;
  shareSlug: string | null;
  shareUrl: string | null;
  joinPath: string | null;
  createdAt: string;
  updatedAt: string;
};

function toJson(row: {
  id: string;
  athleteId: string;
  workoutId: string | null;
  date: Date;
  startTimeLabel: string | null;
  title: string;
  estimatedDistanceMi: number | null;
  isTrack: boolean;
  stravaRouteUrl: string | null;
  meetupLocation: string | null;
  routeDescription: string | null;
  shareSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}, shareUrl: string | null): ScheduledRunJson {
  return {
    id: row.id,
    athleteId: row.athleteId,
    workoutId: row.workoutId,
    date: row.date.toISOString(),
    startTimeLabel: row.startTimeLabel,
    title: row.title,
    estimatedDistanceMi: row.estimatedDistanceMi,
    isTrack: row.isTrack,
    stravaRouteUrl: row.stravaRouteUrl,
    meetupLocation: row.meetupLocation,
    routeDescription: row.routeDescription,
    shareSlug: row.shareSlug,
    shareUrl,
    joinPath: row.shareSlug ? `/join/scheduled-run/${row.shareSlug}` : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * GET /api/training/schedule-run
 * List upcoming scheduled runs for the signed-in athlete.
 * ?days=7 (default 7, max 30)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const daysRaw = request.nextUrl.searchParams.get("days");
    const days = Math.min(Math.max(parseInt(daysRaw ?? "7", 10) || 7, 1), 30);
    const todayKey = ymdFromDate(utcDateOnly(new Date()));
    const start = new Date(`${todayKey}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days);

    const rows = await prisma.scheduled_runs.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const scheduledRuns = rows.map((r) =>
      toJson(
        r,
        r.shareSlug ? shareUrlForSlug(r.shareSlug, request) : null
      )
    );

    return NextResponse.json({ scheduledRuns });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run", e);
    return NextResponse.json({ error: "Failed to load scheduled runs" }, { status: 500 });
  }
}

/**
 * POST /api/training/schedule-run
 * Create a lightweight scheduled run. Optional invite generates shareSlug.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const date = parseDateInput(
      typeof body.date === "string" ? body.date : undefined
    );
    if (!date) {
      return NextResponse.json({ error: "Valid date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    let startTimeLabel: string | null =
      typeof body.startTimeLabel === "string" && body.startTimeLabel.trim()
        ? body.startTimeLabel.trim()
        : null;

    if (!startTimeLabel) {
      const hour =
        typeof body.startTimeHour === "number"
          ? body.startTimeHour
          : parseInt(String(body.startTimeHour ?? ""), 10);
      const minute =
        typeof body.startTimeMinute === "number"
          ? body.startTimeMinute
          : parseInt(String(body.startTimeMinute ?? ""), 10);
      const period =
        body.startTimePeriod === "PM" || body.startTimePeriod === "AM"
          ? body.startTimePeriod
          : null;
      if (
        Number.isFinite(hour) &&
        hour >= 1 &&
        hour <= 12 &&
        Number.isFinite(minute) &&
        minute >= 0 &&
        minute <= 59 &&
        period
      ) {
        startTimeLabel = buildStartTimeLabel(hour, minute, period);
      }
    }

    const workoutId =
      typeof body.workoutId === "string" && body.workoutId.trim()
        ? body.workoutId.trim()
        : null;

    if (workoutId) {
      const owned = await prisma.workouts.findFirst({
        where: { id: workoutId, athleteId: athlete.id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ error: "Workout not found" }, { status: 404 });
      }
    }

    const estimatedDistanceMi =
      typeof body.estimatedDistanceMi === "number" && Number.isFinite(body.estimatedDistanceMi)
        ? body.estimatedDistanceMi
        : body.estimatedDistanceMi != null
          ? parseFloat(String(body.estimatedDistanceMi))
          : null;

    const inviteFriend = body.inviteFriend === true || body.inviteFriend === "true";

    const row = await prisma.scheduled_runs.create({
      data: {
        athleteId: athlete.id,
        workoutId,
        date,
        startTimeLabel,
        title,
        estimatedDistanceMi:
          estimatedDistanceMi != null && Number.isFinite(estimatedDistanceMi)
            ? estimatedDistanceMi
            : null,
        isTrack: body.isTrack === true || body.isTrack === "true",
        stravaRouteUrl:
          typeof body.stravaRouteUrl === "string" && body.stravaRouteUrl.trim()
            ? body.stravaRouteUrl.trim()
            : null,
        meetupLocation:
          typeof body.meetupLocation === "string" && body.meetupLocation.trim()
            ? body.meetupLocation.trim()
            : null,
        routeDescription:
          typeof body.routeDescription === "string" && body.routeDescription.trim()
            ? body.routeDescription.trim()
            : null,
      },
    });

    let shareSlug: string | null = null;
    if (inviteFriend) {
      shareSlug = await assignUniqueScheduledRunShareSlug({
        scheduledRunId: row.id,
        gofastHandle: athlete.gofastHandle,
      });
    }

    const updated = await prisma.scheduled_runs.findUniqueOrThrow({
      where: { id: row.id },
    });

    const shareUrl = shareSlug ? shareUrlForSlug(shareSlug, request) : null;

    return NextResponse.json({
      scheduledRun: toJson(updated, shareUrl),
    });
  } catch (e: unknown) {
    console.error("POST /api/training/schedule-run", e);
    return NextResponse.json({ error: "Failed to create scheduled run" }, { status: 500 });
  }
}
