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
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { newEntityId } from "@/lib/training/new-entity-id";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const METERS_PER_MILE = 1609.34;

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

        if (workout.workoutType === "Intervals") {
          apiSegs = await buildIntervalApiSegments({
            athleteId: auth.athlete.id,
            workoutId,
            workoutDate: workout.date ?? null,
            scheduleTotalMiles: scheduleMiles,
            anchorSecondsPerMile,
          });
        } else if (workout.workoutType === "Tempo") {
          apiSegs = await buildTempoApiSegments({
            athleteId: auth.athlete.id,
            workoutId,
            workoutDate: workout.date ?? null,
            scheduleTotalMiles: scheduleMiles,
            anchorSecondsPerMile,
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
