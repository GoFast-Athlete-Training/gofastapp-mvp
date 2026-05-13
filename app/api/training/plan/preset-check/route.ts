export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { trainingPlanPresetInclude } from "@/lib/training/plan-generate-presets-loader";

type PositionRow = {
  cyclePosition: number;
  distributionWeight: number;
  catalogueId: string | null;
  catalogueName: string | null;
  catalogueSlug: string | null;
};

function mapConfigPositions(
  positions:
    | {
        cyclePosition: number;
        distributionWeight: number;
        catalogueWorkoutId: string | null;
        workout_catalogue: {
          id: string;
          name: string;
          slug: string | null;
        } | null;
      }[]
    | undefined
): PositionRow[] {
  if (!positions?.length) return [];
  return [...positions]
    .sort((a, b) => a.cyclePosition - b.cyclePosition)
    .map((r) => ({
      cyclePosition: r.cyclePosition,
      distributionWeight: r.distributionWeight,
      catalogueId: r.catalogueWorkoutId,
      catalogueName: r.workout_catalogue?.name ?? null,
      catalogueSlug: r.workout_catalogue?.slug ?? null,
    }));
}

/**
 * GET /api/training/plan/preset-check?planId=
 * Read-only: returns the preset row linked on the plan (same include shape as the generator).
 * Does not assign a preset — that must be set in Company or at plan creation.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const planId = request.nextUrl.searchParams.get("planId")?.trim() ?? "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const planRow = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      select: { id: true, name: true, presetId: true },
    });
    if (!planRow) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const storedPresetId = planRow.presetId;

    if (!storedPresetId) {
      return NextResponse.json(
        {
          error:
            "This plan has no training preset assigned. Your coach must pick a blueprint for this plan in GoFast Company before generate.",
        },
        { status: 422 }
      );
    }

    const resolvedPresetId = storedPresetId;

    const rawPreset = await prisma.training_plan_preset.findUnique({
      where: { id: resolvedPresetId },
      include: trainingPlanPresetInclude,
    });

    if (!rawPreset) {
      return NextResponse.json(
        { error: "Preset row missing after link — data inconsistency." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      planId: planRow.id,
      planName: planRow.name,
      storedPresetId,
      resolvedPresetId,
      presetSlug: rawPreset.slug ?? "",
      presetTitle: rawPreset.title ?? "",
      cycleLen: rawPreset.cycleLen,
      minWeeklyMiles: rawPreset.minWeeklyMiles,
      maxWeeklyMiles: rawPreset.maxWeeklyMiles,
      baseMiles: rawPreset.baseMiles,
      peakMiles: rawPreset.peakMiles,
      taperMiles: rawPreset.taperMiles,
      tempoIdealDow: rawPreset.tempoIdealDow,
      intervalIdealDow: rawPreset.intervalIdealDow,
      longRunDefaultDow: rawPreset.longRunDefaultDow,
      positions: {
        longRun: mapConfigPositions(rawPreset.longRunConfig?.positions),
        intervals: mapConfigPositions(rawPreset.intervalsConfig?.positions),
        tempo: mapConfigPositions(rawPreset.tempoConfig?.positions),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "preset-check failed";
    console.error("GET /api/training/plan/preset-check", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
