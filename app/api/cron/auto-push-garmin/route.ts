import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { isEasternHour } from "@/lib/cron/eastern-cron-window";
import { runDailyGarminPushFallback } from "@/lib/garmin-workouts/run-daily-garmin-push-fallback";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EASTERN_PUSH_HOUR = 5;

/**
 * GET /api/cron/auto-push-garmin
 * Morning fallback (5 AM Eastern): materialize today's plan workout and push unsent
 * rows to Garmin for connected athletes with an active plan.
 * Vercel crons are UTC-only — vercel.json fires at 09:00 and 10:00 UTC; this guard
 * ensures exactly one run at 5 AM America/New_York across DST.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const now = new Date();
  if (!isEasternHour(now, EASTERN_PUSH_HOUR)) {
    console.info("[auto-push-garmin] skipped — outside 5 AM Eastern window", {
      utc: now.toISOString(),
      easternHour: now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }),
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "outside_eastern_5am_window",
    });
  }

  try {
    const result = await runDailyGarminPushFallback();
    return NextResponse.json({
      ok: true,
      todayYmd: result.todayYmd,
      materializeResults: result.materializeResults,
      summary: result.summary,
      results: result.results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[auto-push-garmin] cron failed:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
