import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { pushPlanWorkoutsInDateRange } from "@/lib/garmin-workouts/push-plan-workouts-batch";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/auto-push-garmin
 * Push today's already-materialized plan workouts to Garmin Training Calendar.
 * Does not materialize from planSchedule JSON — athletes build the horizon by opening Home/Train.
 * Secured with Authorization: Bearer CRON_SECRET or ?secret= (Vercel Cron uses GET).
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const todayYmd = ymdFromDate(now);
  console.info("[auto-push-garmin] cron start", { todayYmd });

  try {
    const { results, summary } = await pushPlanWorkoutsInDateRange({
      dateStart: start,
      dateEnd: end,
      candidateLimit: 40,
      runLabel: "auto-push-garmin",
    });

    return NextResponse.json({
      ok: true,
      todayYmd,
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
