import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { pushPlanWorkoutsInDateRange } from "@/lib/garmin-workouts/push-plan-workouts-batch";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Days ahead (inclusive) to create Garmin calendar schedules — today + this many future days. */
const GARMIN_SCHEDULE_FORWARD_DAYS = 3;

/**
 * GET /api/cron/auto-push-garmin
 * Push materialized plan workouts to Garmin Training Calendar for today through the next few days.
 * Secured with Authorization: Bearer CRON_SECRET or ?secret= (Vercel Cron uses GET).
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + GARMIN_SCHEDULE_FORWARD_DAYS);
  end.setUTCHours(23, 59, 59, 999);

  const todayYmd = ymdFromDate(now);
  const endYmd = ymdFromDate(end);
  console.info("[auto-push-garmin] cron start", { todayYmd, endYmd, forwardDays: GARMIN_SCHEDULE_FORWARD_DAYS });

  try {
    const { results, summary } = await pushPlanWorkoutsInDateRange({
      dateStart: start,
      dateEnd: end,
      candidateLimit: 80,
      runLabel: "auto-push-garmin",
    });

    return NextResponse.json({
      ok: true,
      todayYmd,
      endYmd,
      forwardDays: GARMIN_SCHEDULE_FORWARD_DAYS,
      candidateCount: summary.candidateCount,
      summary,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("auto-push-garmin cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
