export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ensureTrainingPlanPresetLinked } from "@/lib/training/ensure-training-plan-preset-linked";
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
 * Read-only: same preset resolution + include as the generator. No writes except
 * ensureTrainingPlanPresetLinked may persist a missing presetId (same as generate).
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

    const presetLink = await ensureTrainingPlanPresetLinked({
      planId,
      athleteId: auth.athlete.id,
    });
    if (!presetLink.ok) {
      const msg =
        presetLink.kind === "plan_not_found"
          ? "Plan not found"
          : "No training plan presets are configured.";
      return NextResponse.json(
        { error: msg },
        { status: presetLink.kind === "plan_not_found" ? 404 : 422 }
      );
    }

    const resolvedPresetId = presetLink.presetId;
    const presetWasAutoLinked =
      storedPresetId == null && resolvedPresetId != null;

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

    const vol = rawPreset.volumeConstraints;
    const wk = rawPreset.workoutConfig;

    return NextResponse.json({
      planId: planRow.id,
      planName: planRow.name,
      storedPresetId,
      resolvedPresetId,
      presetWasAutoLinked,
      presetSlug: rawPreset.slug ?? "",
      presetTitle: rawPreset.title ?? "",
      volumeConstraints: vol
        ? {
            baseMiles: vol.baseMiles,
            peakMiles: vol.peakMiles,
            taperMiles: vol.taperMiles,
            cycleLen: vol.cycleLen,
            minWeeklyMiles: vol.minWeeklyMiles,
            maxWeeklyMiles: vol.maxWeeklyMiles,
          }
        : null,
      workoutConfig: wk
        ? {
            tempoIdealDow: wk.tempoIdealDow,
            intervalIdealDow: wk.intervalIdealDow,
            longRunDefaultDow: wk.longRunDefaultDow,
          }
        : null,
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
