import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { runDailyGarminPushFallback } from "@/lib/garmin-workouts/run-daily-garmin-push-fallback";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/auto-push-garmin
 * Morning fallback (5 AM Eastern): materialize today's plan workout and push unsent
 * rows to Garmin for connected athletes with an active plan.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

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
