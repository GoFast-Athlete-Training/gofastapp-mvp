export const dynamic = "force-dynamic";

/**
 * Standalone workout copies on calendar dates (legacy).
 * App UI removed until a plan-aware scheduler / “same workout on date X” flow ships.
 * Kept server-side for future use or integrations.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";
import { newEntityId } from "@/lib/training/new-entity-id";
import { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * POST /api/workouts/[id]/duplicate
 * Clone workout + segments as standalone rows (planId null). Optional repeat expansion.
 *
 * Body: { date: string (required), repeatCount?: number (default 0), repeatIntervalDays?: number (default 7) }
 * Creates (repeatCount + 1) workouts at date, date+interval, ...
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: sourceId } = await ctx.params;

    const source = await prisma.workouts.findFirst({
      where: { id: sourceId, athleteId: auth.athlete.id },
      include: { segments: { orderBy: { stepOrder: "asc" } } },
    });

    if (!source) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const dateParsed = parseOptionalWorkoutDate(body.date);
    if (!dateParsed) {
      return NextResponse.json(
        { error: "date is required (YYYY-MM-DD or ISO datetime)" },
        { status: 400 }
      );
    }

    let repeatCount = 0;
    if (body.repeatCount !== undefined) {
      const r = typeof body.repeatCount === "number" ? body.repeatCount : Number(body.repeatCount);
      if (!Number.isFinite(r) || r < 0 || r > 50) {
        return NextResponse.json(
          { error: "repeatCount must be between 0 and 50" },
          { status: 400 }
        );
      }
      repeatCount = Math.floor(r);
    }

    let repeatIntervalDays = 7;
    if (body.repeatIntervalDays !== undefined) {
      const iv =
        typeof body.repeatIntervalDays === "number"
          ? body.repeatIntervalDays
          : Number(body.repeatIntervalDays);
      if (!Number.isFinite(iv) || iv < 1 || iv > 365) {
        return NextResponse.json(
          { error: "repeatIntervalDays must be between 1 and 365" },
          { status: 400 }
        );
      }
      repeatIntervalDays = Math.floor(iv);
    }

    const createdIds: string[] = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (let i = 0; i <= repeatCount; i++) {
        const scheduleDate = addDaysUtc(dateParsed, i * repeatIntervalDays);
        const newWorkoutId = newEntityId();

        await tx.workouts.create({
          data: {
            id: newWorkoutId,
            title: source.title,
            description: source.description,
            workoutType: source.workoutType,
            athleteId: auth.athlete.id,
            planId: null,
            catalogueWorkoutId: source.catalogueWorkoutId,
            date: scheduleDate,
            estimatedDistanceInMeters: source.estimatedDistanceInMeters,
            nOffset: null,
            weekNumber: null,
            dayAssigned: null,
            planLadderIndex: null,
            garminWorkoutId: null,
            garminScheduleId: null,
            matchedActivityId: null,
            actualDistanceMeters: null,
            actualAvgPaceSecPerMile: null,
            actualAverageHeartRate: null,
            actualDurationSeconds: null,
            actualMaxHeartRate: null,
            actualElevationGain: null,
            actualCalories: null,
            actualSteps: null,
            paceDeltaSecPerMile: null,
            targetPaceSecPerMile: null,
            hrDeltaBpm: null,
            creditedFiveKPaceSecPerMile: null,
            evaluationEligibleFlag: false,
            segments:
              source.segments.length > 0
                ? {
                    create: source.segments.map((seg) => ({
                      id: newEntityId(),
                      stepOrder: seg.stepOrder,
                      title: seg.title,
                      durationType: seg.durationType,
                      durationValue: seg.durationValue,
                      targets:
                        seg.targets === null || seg.targets === undefined
                          ? Prisma.DbNull
                          : (seg.targets as Prisma.InputJsonValue),
                      repeatCount: seg.repeatCount,
                      notes: seg.notes,
                      paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
                    })),
                  }
                : undefined,
          },
        });
        ids.push(newWorkoutId);
      }
      return ids;
    });

    return NextResponse.json({
      workoutIds: createdIds,
      count: createdIds.length,
    });
  } catch (error: unknown) {
    console.error("POST /api/workouts/[id]/duplicate", error);
    return NextResponse.json({ error: "Failed to duplicate workout" }, { status: 500 });
  }
}
