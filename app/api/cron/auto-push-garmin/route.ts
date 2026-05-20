import { NextRequest, NextResponse } from "next/server";
import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import { materializeTodayPlanWorkoutForAthlete } from "@/lib/training/materialize-todays-plan-workout";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/auto-push-garmin
 * 1) Materialize today's plan workout into `workouts` (resolver / find-or-create).
 * 2) Push today's plan workouts (UTC `workouts.date`) to Garmin when not yet pushed.
 * Secured with Authorization: Bearer CRON_SECRET or ?secret= (Vercel Cron uses GET).
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization")?.trim();
  const q = request.nextUrl.searchParams.get("secret")?.trim();
  if (auth !== `Bearer ${expected}` && q !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const todayYmd = ymdFromDate(now);

  try {
    const activePlans = await prisma.training_plans.findMany({
      where: {
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        Athlete: {
          garmin_access_token: { not: null },
          garmin_user_id: { not: null },
        },
      },
      select: { athleteId: true },
      take: 40,
    });

    const materializeResults: Array<{
      athleteId: string;
      status: string;
      workoutId?: string;
      message?: string;
    }> = [];

    const seenAthletes = new Set<string>();
    for (const row of activePlans) {
      if (seenAthletes.has(row.athleteId)) continue;
      seenAthletes.add(row.athleteId);
      const m = await materializeTodayPlanWorkoutForAthlete(row.athleteId, todayYmd);
      materializeResults.push({
        athleteId: row.athleteId,
        status: m.status,
        ...(m.status === "materialized" ? { workoutId: m.workoutId } : {}),
        ...(m.status === "error" ? { message: m.message } : {}),
      });
    }

    const candidates = await prisma.workouts.findMany({
      where: {
        garminWorkoutId: null,
        planId: { not: null },
        date: { gte: start, lte: end },
        Athlete: {
          garmin_access_token: { not: null },
          garmin_user_id: { not: null },
        },
      },
      select: { id: true, athleteId: true },
      take: 40,
    });

    const results: Array<{
      workoutId: string;
      athleteId: string;
      ok: boolean;
      error?: string;
      scheduledDate?: string;
    }> = [];

    for (const w of candidates) {
      const segCount = await prisma.workout_segments.count({
        where: { workoutId: w.id },
      });
      if (segCount === 0) {
        results.push({
          workoutId: w.id,
          athleteId: w.athleteId,
          ok: false,
          error: "no_segments",
        });
        continue;
      }

      const r = await pushWorkoutToGarminForAthlete(w.athleteId, w.id);
      if (r.ok) {
        results.push({
          workoutId: w.id,
          athleteId: w.athleteId,
          ok: true,
          scheduledDate: r.scheduledDate,
        });
      } else {
        results.push({
          workoutId: w.id,
          athleteId: w.athleteId,
          ok: false,
          error: `${r.code}: ${r.message}`,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      todayYmd,
      materializeResults,
      candidateCount: candidates.length,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("auto-push-garmin cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
