import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/auto-push-garmin
 * Pushes today's workouts (UTC calendar date on `workouts.date`) to Garmin for athletes who
 * are connected and have not been pushed yet (`garminWorkoutId` null).
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

  try {
    const candidates = await prisma.workouts.findMany({
      where: {
        garminWorkoutId: null,
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
      todayYmd: ymdFromDate(now),
      candidateCount: candidates.length,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("auto-push-garmin cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
