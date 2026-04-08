export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { planScheduleDaysForWeek } from "@/lib/training/plan-schedule";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";

function utcStartOfDayFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function utcNextDayStartFromKey(dateKey: string): Date {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export type UpcomingSessionJson = {
  id: string;
  title: string;
  workoutType: string;
  date: string;
  matchedActivityId: string | null;
  derivedPerformanceDirection: string | null;
  segments: { stepOrder: number; targets: unknown }[] | undefined;
  workoutId: string | null;
  isPlanSession: boolean;
  estimatedDistanceInMeters: number | null;
};

/**
 * GET /api/training/upcoming
 * Next scheduled sessions from planWeeks (hydrated) + standalone future workouts.
 * Optional: ?limit=5 (max 20)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitRaw ?? "5", 10) || 5, 1),
      20
    );

    const now = new Date();
    const todayKey = ymdFromDate(utcDateOnly(now));

    const plan = await prisma.training_plans.findFirst({
      where: {
        athleteId: athlete.id,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        race_registry: {
          select: { raceDate: true, name: true, distanceMiles: true },
        },
      },
    });

    const race = plan?.race_registry ?? null;
    type Acc = {
      dateKey: string;
      title: string;
      workoutType: string;
      estimatedDistanceInMeters: number;
      isPlanSession: true;
    };
    const planByDate = new Map<string, Acc>();

    if (
      plan &&
      plan.planWeeks != null &&
      plan.totalWeeks >= 1
    ) {
      const effectiveWeeks = effectiveTrainingWeekCount(
        plan.startDate,
        plan.totalWeeks,
        race?.raceDate ?? null
      );
      const startWeek = currentTrainingWeekNumber(
        plan.startDate,
        effectiveWeeks,
        now
      );

      for (
        let weekNum = startWeek;
        weekNum <= effectiveWeeks;
        weekNum++
      ) {
        const weekDays = planScheduleDaysForWeek({
          planStartDate: plan.startDate,
          planWeeks: plan.planWeeks,
          weekNumber: weekNum,
          raceDate: race?.raceDate ?? null,
          raceName: race?.name ?? null,
          raceDistanceMiles: race?.distanceMiles ?? null,
          totalWeeks: effectiveWeeks,
        });

        for (const d of weekDays) {
          if (d.dateKey < todayKey) continue;
          if (!planByDate.has(d.dateKey)) {
            planByDate.set(d.dateKey, {
              dateKey: d.dateKey,
              title: d.title,
              workoutType: d.workoutType,
              estimatedDistanceInMeters: d.estimatedDistanceInMeters,
              isPlanSession: true,
            });
          }
        }

        const futureSlotCount = [...planByDate.keys()].length;
        if (futureSlotCount >= limit) {
          break;
        }
      }
    }

    const planDateKeys = [...planByDate.keys()].sort();
    let materializedByKey = new Map<
      string,
      {
        id: string;
        title: string;
        workoutType: string;
        matchedActivityId: string | null;
        derivedPerformanceDirection: string | null;
        estimatedDistanceInMeters: number | null;
        segments: { stepOrder: number; targets: unknown }[];
      }
    >();

    if (plan && planDateKeys.length > 0) {
      const minKey = planDateKeys[0]!;
      const maxKey = planDateKeys[planDateKeys.length - 1]!;
      const gte = utcStartOfDayFromKey(minKey);
      const lt = utcNextDayStartFromKey(maxKey);

      const rows = await prisma.workouts.findMany({
        where: {
          athleteId: athlete.id,
          planId: plan.id,
          date: { gte, lt },
        },
        include: {
          segments: { orderBy: { stepOrder: "asc" } },
        },
      });

      for (const w of rows) {
        if (!w.date) continue;
        const key = ymdFromDate(utcDateOnly(w.date));
        materializedByKey.set(key, {
          id: w.id,
          title: w.title,
          workoutType: w.workoutType,
          matchedActivityId: w.matchedActivityId,
          derivedPerformanceDirection: w.derivedPerformanceDirection,
          estimatedDistanceInMeters: w.estimatedDistanceInMeters,
          segments: w.segments.map((s) => ({
            stepOrder: s.stepOrder,
            targets: s.targets as unknown,
          })),
        });
      }
    }

    const merged: UpcomingSessionJson[] = [];

    for (const dateKey of planDateKeys) {
      const slot = planByDate.get(dateKey)!;
      const row = materializedByKey.get(dateKey);
      const workoutId = row?.id ?? null;
      merged.push({
        id: workoutId ?? `plan-${dateKey}`,
        title: row?.title ?? slot.title,
        workoutType: row?.workoutType ?? slot.workoutType,
        date: `${dateKey}T12:00:00.000Z`,
        matchedActivityId: row?.matchedActivityId ?? null,
        derivedPerformanceDirection: row?.derivedPerformanceDirection ?? null,
        segments: row?.segments,
        workoutId,
        isPlanSession: true,
        estimatedDistanceInMeters:
          row?.estimatedDistanceInMeters ?? slot.estimatedDistanceInMeters,
      });
    }

    const planKeysSet = new Set(planByDate.keys());
    const todayStart = utcStartOfDayFromKey(todayKey);

    const standalone = await prisma.workouts.findMany({
      where: {
        athleteId: athlete.id,
        planId: null,
        date: { gte: todayStart },
      },
      include: {
        segments: { orderBy: { stepOrder: "asc" } },
      },
      orderBy: { date: "asc" },
      take: Math.max(limit * 3, 15),
    });

    for (const w of standalone) {
      if (!w.date) continue;
      const dk = ymdFromDate(utcDateOnly(w.date));
      if (planKeysSet.has(dk)) continue;
      merged.push({
        id: w.id,
        title: w.title,
        workoutType: w.workoutType,
        date: w.date.toISOString(),
        matchedActivityId: w.matchedActivityId,
        derivedPerformanceDirection: w.derivedPerformanceDirection,
        segments: w.segments.map((s) => ({
          stepOrder: s.stepOrder,
          targets: s.targets as unknown,
        })),
        workoutId: w.id,
        isPlanSession: false,
        estimatedDistanceInMeters: w.estimatedDistanceInMeters,
      });
    }

    merged.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (ta !== tb) return ta - tb;
      if (a.isPlanSession !== b.isPlanSession) return a.isPlanSession ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    const sessions = merged.slice(0, limit);

    const planWeeksArr =
      plan?.planWeeks != null && Array.isArray(plan.planWeeks as unknown[])
        ? (plan.planWeeks as unknown[])
        : [];
    const activePlanSummary = plan
      ? {
          name: plan.name,
          hasSchedule: planWeeksArr.length > 0,
        }
      : null;

    return NextResponse.json({ sessions, activePlanSummary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load upcoming";
    console.error("GET /api/training/upcoming", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
