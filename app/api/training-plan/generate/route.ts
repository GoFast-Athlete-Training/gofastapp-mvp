export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { generatePlanWorkoutRows } from "@/lib/training/generate-plan";
import { selectNextCatalogueWorkout } from "@/lib/training/select-catalogue-workout";
import { newEntityId } from "@/lib/training/new-entity-id";
import { Prisma } from "@prisma/client";

/**
 * POST /api/training-plan/generate
 * Body: { trainingPlanId?, weeklyMileageTarget?, minWeeklyMiles? }
 * Deterministic plan: all workout rows written in one transaction; planWeeks/phases cleared.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const trainingPlanId = body.trainingPlanId as string | undefined;
    if (!trainingPlanId) {
      return NextResponse.json(
        { error: "trainingPlanId is required" },
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
    const drafts = generatePlanWorkoutRows({
      planId: plan.id,
      athleteId: athlete.id,
      totalWeeks: plan.totalWeeks,
      planStartDate: plan.startDate,
      raceDate: race.raceDate,
      weeklyMileageTarget,
      minWeeklyMiles,
      preferredDays,
      raceName: race.name,
      raceDistanceMiles: race.distanceMiles,
    });

    const rows: Prisma.workoutsCreateManyInput[] = [];
    for (const d of drafts) {
      const isRaceDay = d.nOffset === 0;
      const cat = isRaceDay
        ? null
        : await selectNextCatalogueWorkout(
            athlete.id,
            d.workoutType,
            d.phase ?? "base"
          );
      const title =
        cat != null ? `${cat.name} — Week ${d.weekNumber}` : d.title;
      rows.push({
        id: newEntityId(),
        title,
        workoutType: d.workoutType,
        athleteId: d.athleteId,
        planId: d.planId,
        date: d.date,
        phase: d.phase,
        estimatedDistanceInMeters: d.estimatedDistanceInMeters,
        nOffset: d.nOffset,
        weekNumber: d.weekNumber,
        dayAssigned: d.dayAssigned,
        catalogueWorkoutId: cat?.id ?? null,
        updatedAt: new Date(),
      });
    }

    await prisma.$transaction(async (tx) => {
      if (rows.length) {
        await tx.workouts.createMany({ data: rows });
      }
      await tx.training_plans.update({
        where: { id: plan.id },
        data: {
          planWeeks: Prisma.JsonNull,
          phases: Prisma.JsonNull,
          weeklyMileageTarget,
          updatedAt: new Date(),
        },
      });
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
