export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { catalogueEntryToApiSegments } from "@/lib/training/catalogue-to-segments";
import {
  buildIntervalApiSegments,
  buildTempoApiSegments,
  resolvePaceStringForWorkout,
} from "@/lib/training/algo-workout-segments";
import { ladderIndexFromScheduleForDay } from "@/lib/training/schedule-parser";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { newEntityId } from "@/lib/training/new-entity-id";
import type { Prisma, WorkoutType } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const METERS_PER_MILE = 1609.34;

function scheduleStringForPlanWeek(
  planWeeks: unknown,
  weekNumber: number
): string | null {
  if (!planWeeks || !Array.isArray(planWeeks)) return null;
  const entry = planWeeks.find(
    (w) =>
      w &&
      typeof w === "object" &&
      Number((w as Record<string, unknown>).weekNumber) === weekNumber
  ) as Record<string, unknown> | undefined;
  const s = entry?.schedule;
  return typeof s === "string" ? s : null;
}

/** Plan-frozen ladder for I/T; omit return → legacy Garmin-completion rotation. */
function resolvedPlanLadderIndexForWorkout(params: {
  planLadderIndex: number | null;
  weekNumber: number | null;
  dayAssigned: string | null;
  workoutType: WorkoutType;
  planWeeks: unknown;
}): number | undefined {
  if (
    params.planLadderIndex != null &&
    Number.isFinite(params.planLadderIndex)
  ) {
    return params.planLadderIndex;
  }
  if (
    params.workoutType !== "Intervals" &&
    params.workoutType !== "Tempo"
  ) {
    return undefined;
  }
  if (params.weekNumber == null || !params.dayAssigned?.trim()) {
    return undefined;
  }
  const schedule = scheduleStringForPlanWeek(
    params.planWeeks,
    params.weekNumber
  );
  if (!schedule) return undefined;
  const idx = ladderIndexFromScheduleForDay({
    schedule,
    dayAssigned: params.dayAssigned,
    workoutType: params.workoutType,
  });
  if (idx === null) return undefined;
  return idx;
}


/**
 * GET /api/training/workout/[id]
 * Workout + segments. Intervals/Tempo: deterministic segments on first load.
 * Catalogue-linked workouts: lazy segments when missing (Easy/LongRun legacy path).
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;

    const loadWorkout = () =>
      prisma.workouts.findFirst({
        where: { id, athleteId: auth.athlete.id },
        include: {
          segments: { orderBy: { stepOrder: "asc" } },
          workout_catalogue: true,
          training_plans: {
            select: {
              id: true,
              name: true,
              totalWeeks: true,
              currentFiveKPace: true,
              lifecycleStatus: true,
              planWeeks: true,
            },
          },
          matched_activity: {
            select: {
              id: true,
              activityName: true,
              activityType: true,
              startTime: true,
              ingestionStatus: true,
              distance: true,
              duration: true,
              averageSpeed: true,
            },
          },
        },
      });

    let workout = await loadWorkout();

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const athleteFiveKRow = await prisma.athlete.findUnique({
      where: { id: auth.athlete.id },
      select: { fiveKPace: true },
    });

    const paceStr = resolvePaceStringForWorkout(
      workout.training_plans?.currentFiveKPace,
      athleteFiveKRow?.fiveKPace
    );

    if (workout.segments.length === 0 && paceStr) {
      try {
        const workoutId = workout.id;
        const anchorSecondsPerMile = parsePaceToSecondsPerMile(paceStr);
        const scheduleMiles = Math.max(
          1,
          (workout.estimatedDistanceInMeters ?? 0) / METERS_PER_MILE
        );

        let apiSegs: Awaited<ReturnType<typeof buildIntervalApiSegments>> | null =
          null;

        const planLadderIndex = resolvedPlanLadderIndexForWorkout({
          planLadderIndex: workout.planLadderIndex ?? null,
          weekNumber: workout.weekNumber ?? null,
          dayAssigned: workout.dayAssigned ?? null,
          workoutType: workout.workoutType,
          planWeeks: workout.training_plans?.planWeeks ?? null,
        });

        if (workout.workoutType === "Intervals") {
          apiSegs = await buildIntervalApiSegments({
            athleteId: auth.athlete.id,
            workoutId,
            workoutDate: workout.date ?? null,
            scheduleTotalMiles: scheduleMiles,
            anchorSecondsPerMile,
            planLadderIndex,
          });
        } else if (workout.workoutType === "Tempo") {
          apiSegs = await buildTempoApiSegments({
            athleteId: auth.athlete.id,
            workoutId,
            workoutDate: workout.date ?? null,
            scheduleTotalMiles: scheduleMiles,
            anchorSecondsPerMile,
            planLadderIndex,
          });
        } else if (
          workout.workout_catalogue &&
          workout.catalogueWorkoutId
        ) {
          apiSegs = catalogueEntryToApiSegments({
            entry: workout.workout_catalogue,
            scheduleMiles,
            anchorSecondsPerMile,
          });
        }

        if (apiSegs?.length) {
          const segmentRows: Prisma.workout_segmentsCreateManyInput[] =
            apiSegs.map((s) => ({
              id: newEntityId(),
              workoutId,
              stepOrder: s.stepOrder,
              title: s.title,
              durationType: s.durationType,
              durationValue: s.durationValue,
              targets: s.targets as object | undefined,
              repeatCount: s.repeatCount ?? undefined,
              updatedAt: new Date(),
            }));
          await prisma.workout_segments.createMany({ data: segmentRows });
          const reloaded = await loadWorkout();
          if (!reloaded) {
            return NextResponse.json(
              { error: "Workout not found" },
              { status: 404 }
            );
          }
          workout = reloaded;
        }
      } catch (e) {
        console.warn("GET /api/training/workout/[id] lazy segments skipped", e);
      }
    }

    return NextResponse.json({ workout });
  } catch (e: unknown) {
    console.error("GET /api/training/workout/[id]", e);
    return NextResponse.json({ error: "Failed to load workout" }, { status: 500 });
  }
}
