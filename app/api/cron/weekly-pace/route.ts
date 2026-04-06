import { NextRequest, NextResponse } from "next/server";
import { runWeeklyPaceBatchForActivePlans } from "@/lib/training/weekly-pace-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/weekly-pace
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

  try {
    const out = await runWeeklyPaceBatchForActivePlans(new Date());
    return NextResponse.json({
      ok: true,
      plansChecked: out.plansChecked,
      resultCount: out.results.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("weekly-pace cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
