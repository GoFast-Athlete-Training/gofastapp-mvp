export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates, ymdFromDate } from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";
import { archiveOtherActivePlans, cascadeLinkedGoalAfterPlanArchived } from "@/lib/training/plan-lifecycle";
import { validatePreferredTempoInterval } from "@/lib/training/preferred-tempo-interval";

type Ctx = { params: Promise<{ id: string }> };

/** Preference fields allowed on generated plans before regenerate. */
const REGENERATE_PATCH_KEYS = new Set([
  "weeklyMileageTarget",
  "preferredDays",
  "preferredLongRunDow",
  "preferredTempoDow",
  "preferredIntervalDow",
]);

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
        training_plan_preset: {
          include: {
            longRunConfig: {
              include: {
                positions: {
                  orderBy: { cyclePosition: "asc" },
                  include: {
                    workout_catalogue: {
                      select: {
                        id: true,
                        name: true,
                        workoutType: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
            intervalsConfig: {
              include: {
                positions: {
                  orderBy: { cyclePosition: "asc" },
                  include: {
                    workout_catalogue: {
                      select: {
                        id: true,
                        name: true,
                        workoutType: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
            tempoConfig: {
              include: {
                positions: {
                  orderBy: { cyclePosition: "asc" },
                  include: {
                    workout_catalogue: {
                      select: {
                        id: true,
                        name: true,
                        workoutType: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const athleteRow = await prisma.athlete.findUnique({
      where: { id: auth.athlete.id },
      select: { fiveKPace: true },
    });
    const trainingPrefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: auth.athlete.id },
      select: { weeklyMileageTarget: true },
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
      weeklyMileageTargetPreference:
        trainingPrefs?.weeklyMileageTarget != null &&
        Number.isFinite(Number(trainingPrefs.weeklyMileageTarget))
          ? Math.round(Number(trainingPrefs.weeklyMileageTarget))
          : null,
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
      (existing.planSchedule != null &&
        Array.isArray(existing.planSchedule) &&
        (existing.planSchedule as unknown[]).length > 0);

    const body = await request.json();
    const patchKeys = Object.keys(body);
    if (patchKeys.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    if (scheduleLocked) {
      const invalid = patchKeys.filter(
        (k) =>
          k !== "lifecycleStatus" &&
          k !== "currentFiveKPace" &&
          !REGENERATE_PATCH_KEYS.has(k)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error:
              "After the training schedule is generated, only lifecycleStatus, currentFiveKPace, weeklyMileageTarget, and training-day preferences can be updated",
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };

    const canUpdatePreferences =
      !scheduleLocked || patchKeys.some((k) => REGENERATE_PATCH_KEYS.has(k));

    if (canUpdatePreferences) {
      let nextPreferredDays = (existing.preferredDays ?? []).filter(
        (n) => n >= 1 && n <= 7
      );
      let nextLongRun: number | null =
        existing.preferredLongRunDow === 6 || existing.preferredLongRunDow === 7
          ? existing.preferredLongRunDow
          : null;
      let finalTempo = existing.preferredTempoDow ?? null;
      let finalInterval = existing.preferredIntervalDow ?? null;

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
        if ("presetId" in body) {
          const raw = body.presetId;
          if (raw === null || raw === "") {
            data.presetId = null;
          } else {
            const pid = String(raw).trim();
            const exists = await prisma.training_plan_preset.findUnique({
              where: { id: pid },
              select: { id: true },
            });
            if (!exists) {
              return NextResponse.json({ error: "presetId not found" }, { status: 400 });
            }
            data.presetId = pid;
          }
        }
      }
      if (Array.isArray(body.preferredDays)) {
        nextPreferredDays = body.preferredDays
          .map((n: unknown) => Number(n))
          .filter((n: number) => n >= 1 && n <= 7);
        data.preferredDays = nextPreferredDays;
      }
      if ("preferredLongRunDow" in body) {
        const v = body.preferredLongRunDow;
        if (v === null || v === undefined || v === "") {
          data.preferredLongRunDow = null;
          nextLongRun = null;
        } else {
          const n = Number(v);
          if (n === 6 || n === 7) {
            data.preferredLongRunDow = n;
            nextLongRun = n;
          }
        }
      }
      if (body.weeklyMileageTarget != null) {
        const n = Number(body.weeklyMileageTarget);
        if (Number.isFinite(n)) {
          data.weeklyMileageTarget = Math.max(25, Math.min(100, Math.round(n)));
        }
      }

      if ("preferredTempoDow" in body) {
        const v = body.preferredTempoDow;
        if (v === null || v === "") {
          data.preferredTempoDow = null;
          finalTempo = null;
        } else {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 1 || n > 7) {
            return NextResponse.json(
              { error: "preferredTempoDow must be an integer from 1 (Mon) to 7 (Sun), or null" },
              { status: 400 }
            );
          }
          finalTempo = Math.round(n);
          data.preferredTempoDow = finalTempo;
        }
      }
      if ("preferredIntervalDow" in body) {
        const v = body.preferredIntervalDow;
        if (v === null || v === "") {
          data.preferredIntervalDow = null;
          finalInterval = null;
        } else {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 1 || n > 7) {
            return NextResponse.json(
              { error: "preferredIntervalDow must be an integer from 1 (Mon) to 7 (Sun), or null" },
              { status: 400 }
            );
          }
          finalInterval = Math.round(n);
          data.preferredIntervalDow = finalInterval;
        }
      }

      const prefsTouched =
        Array.isArray(body.preferredDays) ||
        "preferredLongRunDow" in body ||
        "preferredTempoDow" in body ||
        "preferredIntervalDow" in body;
      if (prefsTouched) {
        const chk = validatePreferredTempoInterval({
          preferredTempoDow: finalTempo,
          preferredIntervalDow: finalInterval,
          preferredLongRunDow: nextLongRun,
          preferredDays: nextPreferredDays,
        });
        if (!chk.ok) {
          return NextResponse.json({ error: chk.error }, { status: 400 });
        }
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

    if (body.lifecycleStatus === TrainingPlanLifecycle.ARCHIVED) {
      await cascadeLinkedGoalAfterPlanArchived(id, auth.athlete.id);
    }

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
