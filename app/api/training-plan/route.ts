export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates } from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";

/**
 * POST /api/training-plan
 * Create a training plan. Requires an explicit AthleteGoal (race + goal time); no silent goal inference.
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
      raceRegistryId,
      athleteGoalId: bodyGoalId,
      startDate: startRaw,
      name,
      currentWeeklyMileage,
      preferredDays: bodyPreferredDays,
      fiveKPace: bodyFiveK,
      current5KPace: bodyLegacy5k,
      syncAthleteBaseline,
    } = body;
    const body5k = bodyFiveK ?? bodyLegacy5k;

    if (!bodyGoalId || typeof bodyGoalId !== "string") {
      return NextResponse.json(
        { error: "athleteGoalId is required — pick an active goal in training setup" },
        { status: 400 }
      );
    }

    if (!raceRegistryId || !startRaw) {
      return NextResponse.json(
        { error: "raceRegistryId and startDate are required" },
        { status: 400 }
      );
    }

    const goal = await prisma.athleteGoal.findFirst({
      where: {
        id: bodyGoalId,
        athleteId: athlete.id,
      },
    });
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    if (goal.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Goal must be ACTIVE to create a training plan" },
        { status: 400 }
      );
    }
    if (!goal.raceRegistryId) {
      return NextResponse.json(
        { error: "Goal must have a race before creating a training plan" },
        { status: 400 }
      );
    }
    const gt = typeof goal.goalTime === "string" ? goal.goalTime.trim() : "";
    if (!gt) {
      return NextResponse.json(
        { error: "Goal must have a goal time set — finish your goal in Goals first" },
        { status: 400 }
      );
    }
    if (goal.raceRegistryId !== raceRegistryId) {
      return NextResponse.json(
        { error: "raceRegistryId must match the selected goal's race" },
        { status: 400 }
      );
    }

    const race = await prisma.race_registry.findUnique({
      where: { id: raceRegistryId },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const raceDate = new Date(race.raceDate);
    if (startDate >= raceDate) {
      return NextResponse.json(
        { error: "Plan startDate must be before race date" },
        { status: 400 }
      );
    }

    const totalWeeks = totalWeeksFromDates(startDate, raceDate);

    const athleteGoalId = goal.id;

    const prefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: athlete.id },
    });

    const preferredDays =
      Array.isArray(bodyPreferredDays) && bodyPreferredDays.length
        ? bodyPreferredDays.map((n: unknown) => Number(n)).filter((n) => n >= 1 && n <= 7)
        : prefs?.preferredDays?.length
          ? prefs.preferredDays
          : [];

    const fiveKPaceResolved =
      typeof body5k === "string" ? body5k.trim() || null : athlete.fiveKPace ?? null;

    let weeklyResolved: number | null = athlete.weeklyMileage ?? null;
    if (
      currentWeeklyMileage !== undefined &&
      currentWeeklyMileage !== null &&
      currentWeeklyMileage !== ""
    ) {
      const n = Number(currentWeeklyMileage);
      if (Number.isFinite(n)) weeklyResolved = n;
    } else if (currentWeeklyMileage === "" || currentWeeklyMileage === null) {
      weeklyResolved = null;
    }

    const planName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `Training — ${race.name}`;

    const now = new Date();
    const plan = await prisma.$transaction(async (tx) => {
      await tx.training_plans.updateMany({
        where: {
          athleteId: athlete.id,
          lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        },
        data: {
          lifecycleStatus: TrainingPlanLifecycle.ARCHIVED,
          updatedAt: now,
        },
      });
      return tx.training_plans.create({
        data: {
          id: randomUUID(),
          athleteId: athlete.id,
          raceId: race.id,
          athleteGoalId,
          name: planName,
          startDate,
          totalWeeks,
          currentWeeklyMileage: weeklyResolved,
          weeklyMileageTarget:
            weeklyResolved != null && Number.isFinite(Number(weeklyResolved))
              ? Math.max(25, Math.min(100, Math.round(Number(weeklyResolved))))
              : null,
          currentFiveKPace: fiveKPaceResolved,
          lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
          preferredDays,
          updatedAt: now,
        },
      });
    });

    if (syncAthleteBaseline === true || syncAthleteBaseline === "true") {
      await prisma.athlete.update({
        where: { id: athlete.id },
        data: {
          fiveKPace: fiveKPaceResolved,
          weeklyMileage: weeklyResolved,
        },
      });
    }

    const athleteFiveKPaceAfter =
      syncAthleteBaseline === true || syncAthleteBaseline === "true"
        ? fiveKPaceResolved
        : athlete.fiveKPace ?? null;

    return NextResponse.json({
      plan,
      athleteFiveKPace: athleteFiveKPaceAfter,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create plan";
    console.error("POST /api/training-plan", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/training-plan — list athlete's plans (light)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const statusParam = request.nextUrl.searchParams.get("status")?.toLowerCase();
    const lifecycleFilter =
      statusParam === "active"
        ? TrainingPlanLifecycle.ACTIVE
        : statusParam === "archived"
          ? TrainingPlanLifecycle.ARCHIVED
          : null;

    const plans = await prisma.training_plans.findMany({
      where: {
        athleteId: athlete.id,
        ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        totalWeeks: true,
        raceId: true,
        athleteGoalId: true,
        phases: true,
        planWeeks: true,
        lifecycleStatus: true,
        currentFiveKPace: true,
        createdAt: true,
        updatedAt: true,
        race_registry: { select: { name: true } },
        _count: { select: { planned_workouts: true } },
      },
    });

    return NextResponse.json({ plans });
  } catch (e: unknown) {
    console.error("GET /api/training-plan", e);
    return NextResponse.json({ error: "Failed to list plans" }, { status: 500 });
  }
}
