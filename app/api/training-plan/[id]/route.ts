export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates } from "@/lib/training/plan-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            raceDate: true,
            distanceMiles: true,
            raceType: true,
          },
        },
        athlete_goal: {
          select: {
            id: true,
            goalTime: true,
            goalRacePace: true,
            distance: true,
          },
        },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]", e);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const existing = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: { race_registry: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (
      existing.planWeeks != null &&
      Array.isArray(existing.planWeeks) &&
      (existing.planWeeks as unknown[]).length > 0
    ) {
      return NextResponse.json(
        { error: "Cannot update plan after AI schedule is generated" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.name === "string") data.name = body.name.trim();
    if (body.startDate != null) {
      const d = new Date(body.startDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      data.startDate = d;
      if (existing.race_registry) {
        data.totalWeeks = totalWeeksFromDates(d, existing.race_registry.raceDate);
      }
    }
    if (body.currentWeeklyMileage != null) {
      data.currentWeeklyMileage = Number(body.currentWeeklyMileage);
    }
    if (Array.isArray(body.preferredDays)) {
      data.preferredDays = body.preferredDays
        .map((n: unknown) => Number(n))
        .filter((n: number) => n >= 1 && n <= 7);
    }
    if (typeof body.current5KPace === "string") {
      data.current5KPace = body.current5KPace.trim() || null;
    }
    if (body.athleteGoalId != null) {
      const gid = String(body.athleteGoalId);
      const g = await prisma.athleteGoal.findFirst({
        where: { id: gid, athleteId: auth.athlete.id },
      });
      if (!g) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      data.athleteGoalId = gid;
    }

    const plan = await prisma.training_plans.update({
      where: { id },
      data: data as object,
    });

    return NextResponse.json({ plan });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update plan";
    console.error("PATCH /api/training-plan/[id]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
