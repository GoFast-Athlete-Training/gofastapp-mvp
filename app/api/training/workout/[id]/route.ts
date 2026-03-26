export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { catalogueEntryToApiSegments } from "@/lib/training/catalogue-to-segments";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { newEntityId } from "@/lib/training/new-entity-id";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/training/workout/[id]
 * Workout + segments (drill-down). Creates segments from catalogue on first load when missing.
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

    if (
      workout.workout_catalogue &&
      workout.segments.length === 0 &&
      workout.catalogueWorkoutId
    ) {
      const paceStr =
        workout.training_plans?.currentFiveKPace?.trim() ||
        (
          await prisma.athlete.findUnique({
            where: { id: auth.athlete.id },
            select: { fiveKPace: true },
          })
        )?.fiveKPace?.trim();

      if (paceStr) {
        try {
          const workoutId = workout.id;
          const anchorSecondsPerMile = parsePaceToSecondsPerMile(paceStr);
          const scheduleMiles =
            (workout.estimatedDistanceInMeters ?? 0) / 1609.34;
          const apiSegs = catalogueEntryToApiSegments({
            entry: workout.workout_catalogue,
            scheduleMiles,
            anchorSecondsPerMile,
          });
          const segmentRows: Prisma.workout_segmentsCreateManyInput[] = apiSegs.map(
            (s) => ({
              id: newEntityId(),
              workoutId: workoutId,
              stepOrder: s.stepOrder,
              title: s.title,
              durationType: s.durationType,
              durationValue: s.durationValue,
              targets: s.targets as object | undefined,
              repeatCount: s.repeatCount ?? undefined,
              updatedAt: new Date(),
            })
          );
          if (segmentRows.length) {
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
    }

    return NextResponse.json({ workout });
  } catch (e: unknown) {
    console.error("GET /api/training/workout/[id]", e);
    return NextResponse.json({ error: "Failed to load workout" }, { status: 500 });
  }
}
