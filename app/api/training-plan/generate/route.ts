export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  assignRotationalIdentifiers,
  generatePlanWorkoutRows,
  planWeeksSnapshotFromGeneratedRows,
} from "@/lib/training/generate-plan";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { formatPlannedWorkoutTitle } from "@/lib/training/workout-display-title";
import { newEntityId } from "@/lib/training/new-entity-id";
import { buildPlanWorkoutApiSegments } from "@/lib/training/workout-segment-generator";
import { titleFromLadderIndex } from "@/lib/training/algo-workout-segments";
import { Prisma } from "@prisma/client";

/**
 * POST /api/training-plan/generate
 * Body: { trainingPlanId, weeklyMileageTarget?, minWeeklyMiles? }
 *
 * **Generate (one shot):** initial fill only when the plan has zero workouts. Writes `planWeeks`,
 * syncs `currentFiveKPace`, creates workouts (+ segments). See `lib/training/persisted-training-plan.ts`
 * for how **hydrate** (later reads) uses the same `training_plans.id` + athlete from DB only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const trainingPlanId =
      typeof body.trainingPlanId === "string" ? body.trainingPlanId.trim() : "";
    if (!trainingPlanId) {
      return NextResponse.json(
        { error: "trainingPlanId is required (training_plans.id)" },
        { status: 400 }
      );
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: trainingPlanId, athleteId: athlete.id },
      include: {
        race_registry: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.race_registry) {
      return NextResponse.json(
        { error: "Plan must have a race" },
        { status: 400 }
      );
    }

    const existingPlanWorkouts = await prisma.workouts.count({
      where: { planId: plan.id, athleteId: athlete.id },
    });
    if (existingPlanWorkouts > 0) {
      return NextResponse.json(
        { error: "Plan already has scheduled workouts; remove them before regenerating." },
        { status: 400 }
      );
    }

    const prefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: athlete.id },
    });

    const rawMin = body.minWeeklyMiles;
    const minWeeklyMiles =
      typeof rawMin === "number" && Number.isFinite(rawMin)
        ? Math.max(25, Math.min(70, Math.round(rawMin)))
        : 40;

    const rawTarget = body.weeklyMileageTarget;
    let weeklyMileageTarget =
      typeof rawTarget === "number" && Number.isFinite(rawTarget)
        ? Math.round(rawTarget)
        : plan.weeklyMileageTarget ??
          prefs?.weeklyMileageTarget ??
          athlete.weeklyMileage ??
          45;

    weeklyMileageTarget = Math.max(
      minWeeklyMiles,
      Math.min(100, weeklyMileageTarget)
    );

    const preferredDays =
      plan.preferredDays?.length > 0
        ? plan.preferredDays
        : prefs?.preferredDays?.length
          ? prefs.preferredDays
          : [1, 2, 3, 4, 5, 6];

    const race = plan.race_registry;
    const weekCount = calendarTrainingWeekCount(plan.startDate, race.raceDate);
    const drafts = generatePlanWorkoutRows({
      planId: plan.id,
      athleteId: athlete.id,
      totalWeeks: weekCount,
      planStartDate: plan.startDate,
      raceDate: race.raceDate,
      weeklyMileageTarget,
      minWeeklyMiles,
      preferredDays,
      raceName: race.name,
      raceDistanceMiles: race.distanceMiles,
    });
    assignRotationalIdentifiers(drafts);

    const syncedFiveKPace =
      athlete.fiveKPace?.trim() ||
      plan.currentFiveKPace?.trim() ||
      null;
    const needsFiveKAnchor = drafts.some(
      (d) => d.workoutType === "Easy" || d.workoutType === "LongRun"
    );
    if (needsFiveKAnchor && !syncedFiveKPace) {
      return NextResponse.json(
        {
          error:
            "Set 5K pace on your athlete profile before generating a plan (syncs to the plan for workout zones).",
        },
        { status: 400 }
      );
    }

    const rows: Prisma.workoutsCreateManyInput[] = [];
    for (const d of drafts) {
      const isRaceDay = d.nOffset === 0;
      let title: string;
      if (isRaceDay) {
        title = formatPlannedWorkoutTitle(
          d.workoutType,
          d.estimatedDistanceInMeters,
          { isRace: true, raceName: race.name }
        );
      } else if (
        d.workoutType === "Intervals" ||
        d.workoutType === "Tempo"
      ) {
        title = titleFromLadderIndex(
          d.workoutType,
          d.planLadderIndex ?? 0
        )!;
      } else {
        title = formatPlannedWorkoutTitle(
          d.workoutType,
          d.estimatedDistanceInMeters
        );
      }
      rows.push({
        id: newEntityId(),
        title,
        workoutType: d.workoutType,
        athleteId: d.athleteId,
        planId: d.planId,
        date: d.date,
        phase: null,
        estimatedDistanceInMeters: d.estimatedDistanceInMeters,
        nOffset: d.nOffset,
        weekNumber: d.weekNumber,
        dayAssigned: d.dayAssigned,
        catalogueWorkoutId: null,
        planLadderIndex: d.planLadderIndex,
        updatedAt: new Date(),
      });
    }

    const planWeeksSnapshot = planWeeksSnapshotFromGeneratedRows(drafts, weekCount);

    await prisma.$transaction(async (tx) => {
      if (rows.length) {
        await tx.workouts.createMany({ data: rows });
      }
      await tx.training_plans.update({
        where: { id: plan.id },
        data: {
          planWeeks: planWeeksSnapshot as unknown as Prisma.InputJsonValue,
          phases: Prisma.JsonNull,
          weeklyMileageTarget,
          totalWeeks: weekCount,
          ...(syncedFiveKPace != null
            ? { currentFiveKPace: syncedFiveKPace }
            : {}),
          updatedAt: new Date(),
        },
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const d = drafts[i];
        const miles = d.estimatedDistanceInMeters / 1609.34;
        const apiSegs = buildPlanWorkoutApiSegments({
          workoutType: d.workoutType,
          miles,
          currentFiveKPace: syncedFiveKPace,
          catalogueEntry: null,
        });
        if (!apiSegs.length) continue;
        await tx.workout_segments.createMany({
          data: apiSegs.map((s) => ({
            workoutId: row.id as string,
            stepOrder: s.stepOrder,
            title: s.title,
            durationType: s.durationType,
            durationValue: s.durationValue,
            targets: s.targets as object | undefined,
            repeatCount: s.repeatCount ?? undefined,
            updatedAt: new Date(),
          })),
        });
      }
    });

    return NextResponse.json({
      success: true,
      planId: plan.id,
      workoutCount: rows.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Plan generation failed";
    console.error("POST /api/training-plan/generate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
