export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { loadTrainingHydrateSnapshot } from "@/lib/training/training-hydrate-service";
import { applyLightAdaptiveIfEligible } from "@/lib/training/light-adaptive-service";
import { ensureAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";

/**
 * GET /api/training/hydrate
 * Training hydrate snapshot for mobile + web sandbox.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await ensureAthleteProfileSnapshot(auth.athlete.id);

    const snapshot = await loadTrainingHydrateSnapshot(auth.athlete.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load training hydrate";
    console.error("GET /api/training/hydrate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/training/hydrate
 * Optional body: { applyAdaptive?: boolean, planId?: string, weekNumber?: number, workoutId?: string }
 * Applies light adaptive 5K nudge when eligible (sandbox / explicit trigger).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: {
      applyAdaptive?: boolean;
      planId?: string;
      weekNumber?: number;
      workoutId?: string;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* empty body ok */
    }

    if (!body.applyAdaptive) {
      return NextResponse.json(
        { error: "Set applyAdaptive: true to run light adaptive apply" },
        { status: 400 }
      );
    }

    const snapshot = await loadTrainingHydrateSnapshot(auth.athlete.id);
    const planId = body.planId?.trim() || snapshot.planId;
    if (!planId) {
      return NextResponse.json({ error: "No active plan" }, { status: 400 });
    }

    const result = await applyLightAdaptiveIfEligible({
      athleteId: auth.athlete.id,
      planId,
      weekNumber: body.weekNumber ?? null,
      workoutId: body.workoutId ?? null,
    });

    const refreshed = await loadTrainingHydrateSnapshot(auth.athlete.id);
    return NextResponse.json({ ok: true, applyResult: result, snapshot: refreshed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to apply light adaptive";
    console.error("POST /api/training/hydrate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
