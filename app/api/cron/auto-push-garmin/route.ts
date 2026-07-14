import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/auto-push-garmin
 * No-op: Garmin plan workouts are sent only after the athlete verifies in-app.
 * Kept as a cron endpoint so existing Vercel schedules do not 404.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const todayYmd = ymdFromDate(new Date());
  console.info("[auto-push-garmin] skipped — explicit user send required", { todayYmd });

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "explicit_user_send_required",
    todayYmd,
    summary: {
      candidateCount: 0,
      scheduled: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    results: [],
  });
}
