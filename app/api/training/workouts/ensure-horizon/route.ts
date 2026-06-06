export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ensureWorkoutHorizonForAthlete } from "@/lib/training/ensure-workout-horizon";

/**
 * POST /api/training/workouts/ensure-horizon
 * User-triggered rolling materialization for the next N plan days (default 14).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: { days?: unknown; todayKey?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const daysRaw = body.days;
    const days =
      typeof daysRaw === "number" && Number.isFinite(daysRaw)
        ? Math.trunc(daysRaw)
        : undefined;
    const todayKey =
      typeof body.todayKey === "string" ? body.todayKey.trim() : undefined;

    const result = await ensureWorkoutHorizonForAthlete({
      athleteId: auth.athlete.id,
      days,
      startDateKey: todayKey,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to ensure workout horizon";
    console.error("POST /api/training/workouts/ensure-horizon", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
