export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { buildPlanWeekCards } from "@/lib/training/plan-week-cards";
import { workoutHasActuals } from "@/lib/training/workout-has-actuals";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  localTodayKey,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import { resolvePlanTerminalRaceDisplay } from "@/lib/training/plan-race-snapshots";
import { TrainingPlanLifecycle } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";

function utcStartOfDayFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function utcNextDayStartFromKey(dateKey: string): Date {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function isValidTodayKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export type UpcomingSessionJson = {
  id: string;
  title: string;
  workoutType: string;
  date: string;
  garminDetailActivityId: string | null;
  skippedAt: string | null;
  skipReason: string | null;
  /** target − actual sec/mi; positive = faster than prescribed */
  paceDeltaSecPerMile: number | null;
  segments: { stepOrder: number; targets: unknown }[] | undefined;
  workoutId: string | null;
  /** Planned prescribe row id (canonical calendar key). */
  plannedWorkoutId?: string | null;
  isPlanSession: boolean;
  estimatedDistanceInMeters: number | null;
  /** False for plan calendar days (date-only sentinel); true when date includes a real scheduled time. */
  hasScheduledTime: boolean;
};

/**
 * GET /api/training/upcoming
 * Next scheduled sessions from planSchedule (hydrated) + standalone future workouts.
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
    const clientTodayKey = request.nextUrl.searchParams.get("todayKey");
    const todayKey = isValidTodayKey(clientTodayKey?.trim() ?? null)
      ? clientTodayKey!.trim()
      : localTodayKey();

    const plan = await prisma.training_plans.findFirst({
      where: {
        athleteId: athlete.id,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        athlete_race: {
          select: {
            id: true,
            raceRegistryId: true,
            name: true,
            raceDate: true,
            distanceMeters: true,
            distanceLabel: true,
          },
        },
      },
    });

    const terminal = plan ? resolvePlanTerminalRaceDisplay(plan) : null;
    const race = terminal
      ? {
          raceDate: terminal.raceDate,
          name: terminal.name,
          distanceMeters: terminal.distanceMeters,
        }
      : null;
    let planWeekNumber: number | null = null;
    let planTotalWeeks: number | null = null;
    let workoutTodayDone = false;
    const merged: UpcomingSessionJson[] = [];
    const planKeysSet = new Set<string>();

    if (
      plan &&
      plan.planSchedule != null &&
      Array.isArray(plan.planSchedule) &&
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
      planWeekNumber = startWeek;
      planTotalWeeks = effectiveWeeks;

      const raceDistanceMiles =
        race?.distanceMeters != null &&
        Number.isFinite(Number(race.distanceMeters))
          ? metersToMiles(Number(race.distanceMeters))
          : null;

      for (let weekNum = startWeek; weekNum <= effectiveWeeks; weekNum++) {
        const cards = await buildPlanWeekCards({
          planId: plan.id,
          athleteId: athlete.id,
          planStartDate: plan.startDate,
          planSchedule: plan.planSchedule,
          weekNumber: weekNum,
          storedTotalWeeks: plan.totalWeeks,
          raceDate: race?.raceDate ?? null,
          raceName: race?.name ?? null,
          raceDistanceMiles,
        });

        if (weekNum === startWeek) {
          const todayCard = cards.find((c) => c.dateKey === todayKey);
          workoutTodayDone = Boolean(
            todayCard &&
              (workoutHasActuals(todayCard) ||
                (todayCard.workoutId != null && todayCard.skippedAt != null))
          );
        }

        for (const c of cards) {
          if (c.dateKey < todayKey) continue;
          if (planKeysSet.has(c.dateKey)) continue;
          planKeysSet.add(c.dateKey);

          const workoutId = c.workoutId;
          const plannedWorkoutId = c.plannedWorkoutId;
          merged.push({
            id:
              workoutId ??
              (plannedWorkoutId ? `plan-${plannedWorkoutId}` : `plan-${c.dateKey}`),
            title: c.title,
            workoutType: c.workoutType,
            date: `${c.dateKey}T12:00:00.000Z`,
            garminDetailActivityId: c.garminDetailActivityId,
            skippedAt: c.skippedAt,
            skipReason: c.skipReason,
            paceDeltaSecPerMile: null,
            segments: undefined,
            workoutId,
            plannedWorkoutId,
            isPlanSession: true,
            hasScheduledTime: false,
            estimatedDistanceInMeters: c.estimatedDistanceInMeters,
          });
        }

        if (merged.length >= limit) break;
      }
    }
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
        garminDetailActivityId: w.garminDetailActivityId,
        skippedAt: w.skippedAt?.toISOString() ?? null,
        skipReason: w.skipReason ?? null,
        paceDeltaSecPerMile: w.paceDeltaSecPerMile ?? null,
        segments: w.segments.map((s) => ({
          stepOrder: s.stepOrder,
          targets: s.targets as unknown,
        })),
        workoutId: w.id,
        isPlanSession: false,
        hasScheduledTime: true,
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

    const planScheduleArr =
      plan?.planSchedule != null &&
      Array.isArray(plan.planSchedule as unknown[])
        ? (plan.planSchedule as unknown[])
        : [];
    const activePlanSummary = plan
      ? {
          planId: plan.id,
          athleteRaceId: plan.athleteRaceId ?? null,
          name: plan.name,
          hasSchedule: planScheduleArr.length > 0,
          weekNumber: planWeekNumber,
          totalWeeks: planTotalWeeks,
        }
      : null;

    return NextResponse.json({ sessions, activePlanSummary, workoutTodayDone });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load upcoming";
    console.error("GET /api/training/upcoming", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
