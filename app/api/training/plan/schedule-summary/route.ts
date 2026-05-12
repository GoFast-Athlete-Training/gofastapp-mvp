export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

type LongRunRow = { weekNumber: number; miles: number; catalogueWorkoutId: string | null };
type QualityRow = {
  weekNumber: number;
  dow: number;
  miles: number;
  catalogueWorkoutId: string | null;
};

type CyclePoolData = {
  nCycles: number;
  cycleLen: number;
  poolMilesByCycle: number[];
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  positionCounts: { longRun: number; intervals: number; tempo: number };
} | null;

function extractFromSchedule(planSchedule: unknown): {
  longRunByWeek: LongRunRow[];
  intervalsByWeek: QualityRow[];
  temposByWeek: QualityRow[];
} {
  const longRunByWeek: LongRunRow[] = [];
  const intervalsByWeek: QualityRow[] = [];
  const temposByWeek: QualityRow[] = [];

  if (!Array.isArray(planSchedule)) {
    return { longRunByWeek, intervalsByWeek, temposByWeek };
  }

  for (const week of planSchedule as PlanWeekSchedule[]) {
    if (!week || typeof week.weekNumber !== "number" || !Array.isArray(week.days)) continue;
    for (const day of week.days) {
      if (!day || typeof day.dow !== "number") continue;
      if (day.workoutType === "LongRun") {
        longRunByWeek.push({
          weekNumber: week.weekNumber,
          miles: day.miles ?? 0,
          catalogueWorkoutId: day.catalogueWorkoutId ?? null,
        });
      } else if (day.workoutType === "Intervals") {
        intervalsByWeek.push({
          weekNumber: week.weekNumber,
          dow: day.dow,
          miles: day.miles ?? 0,
          catalogueWorkoutId: day.catalogueWorkoutId ?? null,
        });
      } else if (day.workoutType === "Tempo") {
        temposByWeek.push({
          weekNumber: week.weekNumber,
          dow: day.dow,
          miles: day.miles ?? 0,
          catalogueWorkoutId: day.catalogueWorkoutId ?? null,
        });
      }
    }
  }

  longRunByWeek.sort((a, b) => a.weekNumber - b.weekNumber);
  intervalsByWeek.sort((a, b) => a.weekNumber - b.weekNumber);
  temposByWeek.sort((a, b) => a.weekNumber - b.weekNumber);

  return { longRunByWeek, intervalsByWeek, temposByWeek };
}

/**
 * GET /api/training/plan/schedule-summary?planId=
 * Returns cycle pool data and per-week LR/interval/tempo breakdown from stored planSchedule JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      select: { planSchedule: true, cyclePoolData: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { longRunByWeek, intervalsByWeek, temposByWeek } = extractFromSchedule(plan.planSchedule);

    return NextResponse.json({
      cyclePoolData: (plan.cyclePoolData ?? null) as CyclePoolData,
      longRunByWeek,
      intervalsByWeek,
      temposByWeek,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load summary";
    console.error("GET /api/training/plan/schedule-summary", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
