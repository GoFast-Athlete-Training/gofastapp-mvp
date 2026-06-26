export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  assignUniqueWorkoutScheduledShareSlug,
  scheduleRunWorkoutWhere,
  upsertScheduleRunWorkout,
  workoutToScheduleRunRow,
} from "@/lib/training/schedule-run-workout";
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

function toJson(row: ReturnType<typeof workoutToScheduleRunRow> extends infer R ? NonNullable<R> : never, shareUrl: string | null): ScheduledRunJson {
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
 * List upcoming scheduled workouts for the signed-in athlete.
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

    const rows = await prisma.workouts.findMany({
      where: scheduleRunWorkoutWhere(athlete.id, start, end),
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const scheduledRuns = rows
      .map((r) => workoutToScheduleRunRow(r))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => toJson(r, r.shareSlug ? shareUrlForSlug(r.shareSlug, request) : null));

    return NextResponse.json({ scheduledRuns });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run", e);
    return NextResponse.json({ error: "Failed to load scheduled runs" }, { status: 500 });
  }
}

/**
 * POST /api/training/schedule-run
 * Create or update a workout-backed scheduled run. Optional invite generates scheduledShareSlug.
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

    const estimatedDistanceMi =
      typeof body.estimatedDistanceMi === "number" && Number.isFinite(body.estimatedDistanceMi)
        ? body.estimatedDistanceMi
        : body.estimatedDistanceMi != null
          ? parseFloat(String(body.estimatedDistanceMi))
          : null;

    let upsertedWorkoutId: string;
    try {
      const result = await upsertScheduleRunWorkout({
        athleteId: athlete.id,
        title,
        date,
        startTimeLabel,
        workoutId,
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
      });
      upsertedWorkoutId = result.workoutId;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "WORKOUT_NOT_FOUND") {
        return NextResponse.json({ error: "Workout not found" }, { status: 404 });
      }
      throw e;
    }

    const inviteFriend = body.inviteFriend === true || body.inviteFriend === "true";
    if (inviteFriend) {
      await assignUniqueWorkoutScheduledShareSlug({
        workoutId: upsertedWorkoutId,
        gofastHandle: athlete.gofastHandle,
      });
    }

    const updated = await prisma.workouts.findUniqueOrThrow({
      where: { id: upsertedWorkoutId },
    });

    const row = workoutToScheduleRunRow(updated);
    if (!row) {
      return NextResponse.json({ error: "Failed to load scheduled workout" }, { status: 500 });
    }

    const shareUrl = row.shareSlug ? shareUrlForSlug(row.shareSlug, request) : null;

    return NextResponse.json({
      scheduledRun: toJson(row, shareUrl),
    });
  } catch (e: unknown) {
    console.error("POST /api/training/schedule-run", e);
    return NextResponse.json({ error: "Failed to create scheduled run" }, { status: 500 });
  }
}
