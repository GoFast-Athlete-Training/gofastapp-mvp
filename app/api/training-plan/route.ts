export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates } from "@/lib/training/plan-utils";

/**
 * POST /api/training-plan
 * Create a training plan (race required). Snapshots preferredDays from TrainingPreferences.
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
      current5KPace: body5k,
    } = body;

    if (!raceRegistryId || !startRaw) {
      return NextResponse.json(
        { error: "raceRegistryId and startDate are required" },
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

    let athleteGoalId: string | null = bodyGoalId ?? null;
    if (!athleteGoalId) {
      const goal = await prisma.athleteGoal.findFirst({
        where: {
          athleteId: athlete.id,
          status: "ACTIVE",
          raceRegistryId,
        },
        orderBy: { targetByDate: "asc" },
      });
      athleteGoalId = goal?.id ?? null;
    } else {
      const goal = await prisma.athleteGoal.findFirst({
        where: {
          id: athleteGoalId,
          athleteId: athlete.id,
        },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
    }

    const prefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: athlete.id },
    });

    const preferredDays =
      Array.isArray(bodyPreferredDays) && bodyPreferredDays.length
        ? bodyPreferredDays.map((n: unknown) => Number(n)).filter((n) => n >= 1 && n <= 7)
        : prefs?.preferredDays?.length
          ? prefs.preferredDays
          : [];

    const current5KPace =
      typeof body5k === "string" && body5k.trim()
        ? body5k.trim()
        : athlete.fiveKPace ?? null;

    const planName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `Training — ${race.name}`;

    const now = new Date();
    const plan = await prisma.training_plans.create({
      data: {
        id: randomUUID(),
        athleteId: athlete.id,
        raceId: race.id,
        athleteGoalId,
        name: planName,
        startDate,
        totalWeeks,
        currentWeeklyMileage:
          currentWeeklyMileage != null
            ? Number(currentWeeklyMileage)
            : athlete.weeklyMileage ?? null,
        preferredDays,
        current5KPace,
        updatedAt: now,
      },
    });

    return NextResponse.json({ plan });
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

    const plans = await prisma.training_plans.findMany({
      where: { athleteId: athlete.id },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ plans });
  } catch (e: unknown) {
    console.error("GET /api/training-plan", e);
    return NextResponse.json({ error: "Failed to list plans" }, { status: 500 });
  }
}
