export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  buildIntervalApiSegments,
  buildTempoApiSegments,
  resolvePaceStringForWorkout,
} from "@/lib/training/algo-workout-segments";
import { buildPlanWorkoutApiSegments } from "@/lib/training/workout-segment-generator";
import type { ApiSegment } from "@/lib/workout-generator/templates";
import { cycleIndexFromScheduleForDay } from "@/lib/training/schedule-parser";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { newEntityId } from "@/lib/training/new-entity-id";
import { metersToMiles } from "@/lib/pace-utils";
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

/** Plan-frozen cycle index for I/T/LR(mp); omit return → legacy Garmin-completion rotation. */
function resolvedPlanCycleIndexForWorkout(params: {
  planCycleIndex: number | null;
  weekNumber: number | null;
  dayAssigned: string | null;
  workoutType: WorkoutType;
  planWeeks: unknown;
}): number | undefined {
  if (
    params.planCycleIndex != null &&
    Number.isFinite(params.planCycleIndex)
  ) {
    return params.planCycleIndex;
  }
  if (
    params.workoutType !== "Intervals" &&
    params.workoutType !== "Tempo" &&
    params.workoutType !== "LongRun"
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
  const idx = cycleIndexFromScheduleForDay({
    schedule,
    dayAssigned: params.dayAssigned,
    workoutType: params.workoutType,
  });
  if (idx === null) return undefined;
  return idx;
}


/**
 * GET /api/training/workout/[id]
 * Workout + segments. Lazy create when empty: I/T via algo; Easy/LongRun/Race via
 * templates + plan pace (plan path). Legacy rows may still link a catalogue entry.
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
              goalRaceTime: true,
              goalRacePace: true,
              lifecycleStatus: true,
              planWeeks: true,
              race_registry: {
                select: { distanceMeters: true },
              },
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
          city_runs: {
            select: { id: true, date: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 3,
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

        let apiSegs: ApiSegment[] | null = null;

        const planCycleIndex = resolvedPlanCycleIndexForWorkout({
          planCycleIndex: workout.planCycleIndex ?? null,
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
            planCycleIndex,
          });
        } else if (workout.workoutType === "Tempo") {
          apiSegs = await buildTempoApiSegments({
            athleteId: auth.athlete.id,
            workoutId,
            workoutDate: workout.date ?? null,
            scheduleTotalMiles: scheduleMiles,
            anchorSecondsPerMile,
            planCycleIndex,
          });
        } else if (
          workout.workoutType === "Easy" ||
          workout.workoutType === "LongRun" ||
          workout.workoutType === "Race"
        ) {
          const dm = workout.training_plans?.race_registry?.distanceMeters;
          const raceDistanceMiles =
            dm != null && Number.isFinite(Number(dm))
              ? metersToMiles(Number(dm))
              : null;
          apiSegs = buildPlanWorkoutApiSegments({
            workoutType: workout.workoutType,
            miles: scheduleMiles,
            currentFiveKPace: paceStr,
            catalogueEntry:
              workout.catalogueWorkoutId && workout.workout_catalogue
                ? workout.workout_catalogue
                : null,
            goalRacePace: workout.training_plans?.goalRacePace ?? null,
            goalRaceTime: workout.training_plans?.goalRaceTime ?? null,
            raceDistanceMiles,
            planCycleIndex: workout.planCycleIndex ?? null,
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
              paceTargetEncodingVersion: 2,
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
