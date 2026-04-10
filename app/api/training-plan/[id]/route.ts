export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates, ymdFromDate } from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";
import { archiveOtherActivePlans } from "@/lib/training/plan-lifecycle";

type Ctx = { params: Promise<{ id: string }> };

/** `id` = `training_plans.id` (see `lib/training/persisted-training-plan.ts` for generate vs week/workout flows). */
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
            distanceMeters: true,
            distanceLabel: true,
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
        _count: { select: { planned_workouts: true } },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const athleteRow = await prisma.athlete.findUnique({
      where: { id: auth.athlete.id },
      select: { fiveKPace: true },
    });

    const serialized = {
      ...plan,
      startDate: ymdFromDate(plan.startDate),
      race_registry: plan.race_registry
        ? {
            ...plan.race_registry,
            raceDate: ymdFromDate(plan.race_registry.raceDate),
          }
        : null,
    };

    return NextResponse.json({
      plan: serialized,
      athleteFiveKPace: athleteRow?.fiveKPace ?? null,
    });
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

    const planWorkoutCount = await prisma.workouts.count({
      where: { planId: existing.id, athleteId: auth.athlete.id },
    });
    const scheduleLocked =
      planWorkoutCount > 0 ||
      (existing.planWeeks != null &&
        Array.isArray(existing.planWeeks) &&
        (existing.planWeeks as unknown[]).length > 0);

    const body = await request.json();
    const patchKeys = Object.keys(body);
    if (patchKeys.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    if (scheduleLocked) {
      const invalid = patchKeys.filter(
        (k) => k !== "lifecycleStatus" && k !== "currentFiveKPace"
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error:
              "After the training schedule is generated, only lifecycleStatus and currentFiveKPace can be updated",
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (!scheduleLocked) {
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
      if ("preferredLongRunDow" in body) {
        const v = body.preferredLongRunDow;
        if (v === null || v === undefined || v === "") {
          data.preferredLongRunDow = null;
        } else {
          const n = Number(v);
          if (n === 6 || n === 7) {
            data.preferredLongRunDow = n;
          }
        }
      }
      if (body.weeklyMileageTarget != null) {
        const n = Number(body.weeklyMileageTarget);
        if (Number.isFinite(n)) {
          data.weeklyMileageTarget = Math.max(25, Math.min(100, Math.round(n)));
        }
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
    }

    if (typeof body.currentFiveKPace === "string") {
      data.currentFiveKPace = body.currentFiveKPace.trim() || null;
    } else if (body.currentFiveKPace === null) {
      data.currentFiveKPace = null;
    }

    if (body.lifecycleStatus === TrainingPlanLifecycle.ACTIVE) {
      await archiveOtherActivePlans(auth.athlete.id, id);
      data.lifecycleStatus = TrainingPlanLifecycle.ACTIVE;
    } else if (body.lifecycleStatus === TrainingPlanLifecycle.ARCHIVED) {
      data.lifecycleStatus = TrainingPlanLifecycle.ARCHIVED;
    }

    const planRow = await prisma.training_plans.update({
      where: { id },
      data: data as object,
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            raceDate: true,
            distanceMeters: true,
            distanceLabel: true,
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
        _count: { select: { planned_workouts: true } },
      },
    });

    const athleteRow = await prisma.athlete.findUnique({
      where: { id: auth.athlete.id },
      select: { fiveKPace: true },
    });

    const serialized = {
      ...planRow,
      startDate: ymdFromDate(planRow.startDate),
      race_registry: planRow.race_registry
        ? {
            ...planRow.race_registry,
            raceDate: ymdFromDate(planRow.race_registry.raceDate),
          }
        : null,
    };

    return NextResponse.json({
      plan: serialized,
      athleteFiveKPace: athleteRow?.fiveKPace ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update plan";
    console.error("PATCH /api/training-plan/[id]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const result = await prisma.training_plans.deleteMany({
      where: { id, athleteId: auth.athlete.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete plan";
    console.error("DELETE /api/training-plan/[id]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
