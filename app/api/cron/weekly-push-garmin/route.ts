import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { runWeeklyGarminPushForActivePlans } from "@/lib/garmin-workouts/run-weekly-garmin-push";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/weekly-push-garmin
 * Materialize the 14-day workout horizon for connected athletes — no Garmin auto-push.
 * Athletes verify workouts in-app and send to Garmin explicitly.
 * Secured with Authorization: Bearer CRON_SECRET or ?secret= (Vercel Cron uses GET).
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const out = await runWeeklyGarminPushForActivePlans(new Date());
    return NextResponse.json({
      ok: true,
      weekStartYmd: out.weekStartYmd,
      weekEndYmd: out.weekEndYmd,
      athleteCount: out.athleteCount,
      horizonPreflightCount: out.horizonPreflight.length,
      summary: out.push,
      results: out.results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("weekly-push-garmin cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
