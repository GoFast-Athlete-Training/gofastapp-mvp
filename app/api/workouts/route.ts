import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD → [start, end) in UTC for that calendar day */
function utcDayRangeFromYmd(dateStr: string): { gte: Date; lt: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return {
    gte: new Date(Date.UTC(y, mo - 1, d, 0, 0, 0)),
    lt: new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0)),
  };
}

/**
 * GET /api/workouts
 * List workouts for the authenticated athlete.
 * Optional: `?limit=20&offset=0` for pagination (max limit 100). When omitted, returns all (legacy).
 * Optional: `?standalone=1` — only workouts with no training plan (`planId` null).
 * Optional: `?date=YYYY-MM-DD` — only workouts whose scheduled `date` falls on that calendar day (UTC).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");
    const usePaging =
      limitRaw != null ||
      offsetRaw != null ||
      searchParams.get("paged") === "1";

    let take: number | undefined;
    let skip = 0;
    if (usePaging) {
      const limit = Math.min(
        Math.max(parseInt(limitRaw ?? "20", 10) || 20, 1),
        100
      );
      take = limit;
      skip = Math.max(parseInt(offsetRaw ?? "0", 10) || 0, 0);
    }

    const standaloneOnly = searchParams.get("standalone") === "1";
    const dateParam = searchParams.get("date");
    const dateRange =
      dateParam && dateParam.trim() ? utcDayRangeFromYmd(dateParam) : null;

    const where = {
      athleteId: athlete.id,
      ...(standaloneOnly ? { planId: null } : {}),
      ...(dateRange ? { date: { gte: dateRange.gte, lt: dateRange.lt } } : {}),
    };

    const [workouts, total] = await Promise.all([
      usePaging
        ? prisma.workouts.findMany({
            where,
            select: {
              id: true,
              title: true,
              workoutType: true,
              description: true,
              date: true,
              matchedActivityId: true,
              estimatedDistanceInMeters: true,
              planId: true,
              _count: { select: { segments: true } },
            },
            orderBy: { createdAt: "desc" },
            take: take!,
            skip,
          })
        : prisma.workouts.findMany({
            where,
            include: {
              segments: {
                orderBy: { stepOrder: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
      usePaging
        ? prisma.workouts.count({ where })
        : Promise.resolve(0),
    ]);

    if (usePaging) {
      return NextResponse.json({
        workouts,
        total,
        offset: skip,
        hasMore: skip + workouts.length < total,
      });
    }

    return NextResponse.json({ workouts });
  } catch (error: any) {
    console.error("Error fetching workouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch workouts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workouts
 * Body: `{ "ids": string[] }` — delete many workouts owned by the athlete.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const ids =
      body &&
      typeof body === "object" &&
      "ids" in body &&
      Array.isArray((body as { ids: unknown }).ids)
        ? (body as { ids: unknown[] }).ids.filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Provide a non-empty ids array" },
        { status: 400 }
      );
    }

    const result = await prisma.workouts.deleteMany({
      where: { athleteId: athlete.id, id: { in: ids } },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error: unknown) {
    console.error("DELETE /api/workouts", error);
    return NextResponse.json(
      { error: "Failed to delete workouts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workouts
 * Create a new workout
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const {
      title,
      description,
      workoutType = "Easy",
      segments, // Array of segment objects
      date: dateRaw,
    } = body;

    // Same calendar convention as plan workouts + Garmin push: YYYY-MM-DD → UTC noon via parseOptionalWorkoutDate.
    // If standalone builder omits date, default to UTC “today” so schedule + Connect stay aligned.
    const scheduleDate =
      parseOptionalWorkoutDate(dateRaw) ??
      parseOptionalWorkoutDate(ymdFromDate(new Date()));

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "At least one segment is required" },
        { status: 400 }
      );
    }

    // Create workout with segments
    const workout = await prisma.workouts.create({
      data: {
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        workoutType: workoutType as any,
        athleteId: athlete.id,
        date: scheduleDate,
        segments: {
          create: segments.map((seg: any, index: number) => ({
            id: `segment_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            stepOrder: seg.stepOrder || index + 1,
            title: seg.title,
            durationType: seg.durationType || "DISTANCE",
            durationValue: seg.durationValue,
            targets: seg.targets || null, // JSON array of target objects
            repeatCount: seg.repeatCount || null,
            notes: seg.notes || null,
            paceTargetEncodingVersion: 2,
          })),
        },
      },
      include: {
        segments: true,
      },
    });

    return NextResponse.json({ workout });
  } catch (error: any) {
    console.error("Error creating workout:", error);
    return NextResponse.json(
      { error: "Failed to create workout" },
      { status: 500 }
    );
  }
}
