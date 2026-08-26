export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  athletePresetInclude,
  serializeAthletePresetForApi,
} from "@/lib/training/athlete-preset-blueprint";
import {
  cloneRotationsFromSourcePreset,
  seedWorkoutBlueprintFromSource,
  setupAthleteRotationsFromSource,
} from "@/lib/training/clone-preset-configs";
import { deleteAthletePresetForAthlete } from "@/lib/training/delete-athlete-preset";
import {
  coachOverviewFromCoreInfer,
  mergeCoachPlanOverview,
} from "@/lib/training/athlete-preset-coach-overview";
import { computeCoreVolumeCalendarPreview } from "@/lib/training/core-volume-compute";
import {
  reorderAthleteEasyOrder,
  reorderAthleteLongRunOrder,
  saveAthleteIntervalsSelection,
  saveAthleteTempoSelection,
} from "@/lib/training/athlete-rotation-setup";
import {
  adjusterToAthleteColumns,
  DEFAULT_ATHLETE_PACE_ADJUSTER,
  parseAdjusterPatch,
} from "@/lib/training/athlete-pace-adjuster";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOwnedPreset(athleteId: string, id: string) {
  return prisma.athlete_presets.findFirst({
    where: { id, athleteId },
    include: athletePresetInclude,
  });
}

/** GET /api/athlete-presets/[id] — resume athlete-owned preset builder */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const row = await loadOwnedPreset(auth.athlete.id, id);
    if (!row) {
      return NextResponse.json({ error: "Athlete preset not found" }, { status: 404 });
    }
    return NextResponse.json({ athletePreset: serializeAthletePresetForApi(row) });
  } catch (e: unknown) {
    console.error("GET /api/athlete-presets/[id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load athlete preset" },
      { status: 500 }
    );
  }
}

/** PATCH /api/athlete-presets/[id] — builder steps: foundation, run types, adjuster */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const existing = await loadOwnedPreset(auth.athlete.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Athlete preset not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.athlete_presetsUpdateInput = { updatedAt: new Date() };

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }
    if ("description" in body) {
      data.description =
        body.description === null
          ? null
          : typeof body.description === "string"
            ? body.description.trim() || null
            : existing.description;
    }
    if ("objectiveOfPlan" in body) {
      data.objectiveOfPlan =
        body.objectiveOfPlan === null
          ? null
          : typeof body.objectiveOfPlan === "string"
            ? body.objectiveOfPlan.trim() || null
            : existing.objectiveOfPlan;
    }

    if (body.step === "core" || "baseLongRunPoolMiles" in body) {
      const num = (v: unknown, fallback: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      if ("baseLongRunPoolMiles" in body) data.baseLongRunPoolMiles = num(body.baseLongRunPoolMiles, existing.baseLongRunPoolMiles);
      if ("peakLongRunPoolMiles" in body) data.peakLongRunPoolMiles = num(body.peakLongRunPoolMiles, existing.peakLongRunPoolMiles);
      if ("taperLongRunPoolMiles" in body) data.taperLongRunPoolMiles = num(body.taperLongRunPoolMiles, existing.taperLongRunPoolMiles);
      if ("minWeeklyMiles" in body) {
        data.minWeeklyMiles = Math.max(1, Math.round(num(body.minWeeklyMiles, existing.minWeeklyMiles)));
      }
      if ("maxWeeklyMiles" in body) {
        const raw = body.maxWeeklyMiles;
        data.maxWeeklyMiles =
          raw == null || raw === ""
            ? null
            : Math.max(1, Math.round(num(raw, existing.maxWeeklyMiles ?? 0)));
      }
      if (body.step === "core" && body.action === "confirmCups") {
        const base = num(body.baseLongRunPoolMiles, existing.baseLongRunPoolMiles);
        const peak = num(body.peakLongRunPoolMiles, existing.peakLongRunPoolMiles);
        const taper = num(body.taperLongRunPoolMiles, existing.taperLongRunPoolMiles);
        if (existing.trainingStartDate && existing.raceDateSnapshot) {
          const calendar = computeCoreVolumeCalendarPreview({
            planStartDate: existing.trainingStartDate,
            raceDate: existing.raceDateSnapshot,
            baseLongRunPoolMiles: base,
            peakLongRunPoolMiles: peak,
            taperLongRunPoolMiles: taper,
          });
          data.peakLongRunDate = calendar.peakLongRunDate
            ? new Date(`${calendar.peakLongRunDate}T12:00:00.000Z`)
            : null;
          data.taperStartDate = calendar.taperStartDate
            ? new Date(`${calendar.taperStartDate}T12:00:00.000Z`)
            : null;
          const overview = existing.coachPlanOverview;
          const weSeeYou =
            overview != null &&
            typeof overview === "object" &&
            !Array.isArray(overview) &&
            typeof (overview as Record<string, unknown>).weSeeYou === "string"
              ? String((overview as Record<string, unknown>).weSeeYou)
              : "";
          const barriers =
            overview != null &&
            typeof overview === "object" &&
            !Array.isArray(overview) &&
            Array.isArray((overview as Record<string, unknown>).barriers)
              ? ((overview as Record<string, unknown>).barriers as string[])
              : [];
          const progressionAggressiveness =
            existing.progressionAggressiveness ?? "MODERATE";
          const weeklyVolumeBand =
            overview != null &&
            typeof overview === "object" &&
            !Array.isArray(overview) &&
            typeof (overview as Record<string, unknown>).weeklyVolumeBand === "string"
              ? String((overview as Record<string, unknown>).weeklyVolumeBand)
              : undefined;
          data.coachPlanOverview = mergeCoachPlanOverview(
            existing.coachPlanOverview,
            coachOverviewFromCoreInfer({
              weSeeYou,
              barriers,
              progressionAggressiveness,
              weeklyVolumeBand,
              minWeeklyMiles: existing.minWeeklyMiles,
              maxWeeklyMiles: existing.maxWeeklyMiles,
              calendar,
              cupsConfirmed: true,
            })
          );
        } else {
          data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
            cupsConfirmed: true,
          });
        }
      }
    }

    if (body.step === "core" && body.action === "setupWorkouts") {
      if (!existing.sourcePresetId) {
        return NextResponse.json({ error: "sourcePresetId missing" }, { status: 422 });
      }
      await seedWorkoutBlueprintFromSource({
        athletePresetId: id,
        sourcePresetId: existing.sourcePresetId,
      });
      await setupAthleteRotationsFromSource({
        athletePresetId: id,
        sourcePresetId: existing.sourcePresetId,
      });
      const refreshed = await loadOwnedPreset(auth.athlete.id, id);
      return NextResponse.json({
        athletePreset: refreshed ? serializeAthletePresetForApi(refreshed) : null,
      });
    }

    if (body.step === "workouts" || "workoutStructure" in body) {
      if ("workoutStructure" in body) {
        if (body.workoutStructure === null) {
          data.workoutStructure = Prisma.JsonNull;
        } else if (typeof body.workoutStructure === "object") {
          data.workoutStructure = body.workoutStructure as Prisma.InputJsonValue;
        }
      }
      if ("coachPlanOverview" in body) {
        if (body.coachPlanOverview === null) {
          data.coachPlanOverview = Prisma.JsonNull;
        } else if (typeof body.coachPlanOverview === "object") {
          data.coachPlanOverview = body.coachPlanOverview as Prisma.InputJsonValue;
        }
      }
      if ("easyRunConfig" in body) {
        if (body.easyRunConfig === null) {
          data.easyRunConfig = Prisma.JsonNull;
        } else if (typeof body.easyRunConfig === "object") {
          data.easyRunConfig = body.easyRunConfig as Prisma.InputJsonValue;
        }
      }
    }

    if (body.step === "rotations" && body.action === "cloneFromSource") {
      if (!existing.sourcePresetId) {
        return NextResponse.json({ error: "sourcePresetId missing" }, { status: 422 });
      }
      await setupAthleteRotationsFromSource({
        athletePresetId: id,
        sourcePresetId: existing.sourcePresetId,
      });
      const refreshed = await loadOwnedPreset(auth.athlete.id, id);
      return NextResponse.json({
        athletePreset: refreshed ? serializeAthletePresetForApi(refreshed) : null,
      });
    }

    if (body.step === "workouts" && body.action === "seedFromSource") {
      if (!existing.sourcePresetId) {
        return NextResponse.json({ error: "sourcePresetId missing" }, { status: 422 });
      }
      await seedWorkoutBlueprintFromSource({
        athletePresetId: id,
        sourcePresetId: existing.sourcePresetId,
      });
      const refreshed = await loadOwnedPreset(auth.athlete.id, id);
      return NextResponse.json({
        athletePreset: refreshed ? serializeAthletePresetForApi(refreshed) : null,
      });
    }

    if (body.step === "longRun" && body.action === "reorderPositions") {
      const ordered = body.orderedPositionIds;
      if (!Array.isArray(ordered) || !ordered.every((x) => typeof x === "string")) {
        return NextResponse.json({ error: "orderedPositionIds required" }, { status: 400 });
      }
      if (!existing.longRunConfigId) {
        return NextResponse.json({ error: "long run config missing" }, { status: 422 });
      }
      await reorderAthleteLongRunOrder({
        athletePresetId: id,
        orderedPositionIds: ordered as string[],
      });
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        longRunConfirmed: true,
      });
    }

    if (body.step === "longRun" && body.action === "confirm") {
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        longRunConfirmed: true,
      });
    }

    if (body.step === "easy" && body.action === "reorderPositions") {
      const ordered = body.orderedPositionIds;
      if (!Array.isArray(ordered) || !ordered.every((x) => typeof x === "string")) {
        return NextResponse.json({ error: "orderedPositionIds required" }, { status: 400 });
      }
      await reorderAthleteEasyOrder({
        athletePresetId: id,
        orderedPositionIds: ordered as string[],
      });
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        easyConfirmed: true,
      });
    }

    if (body.step === "tempo" && body.action === "saveSelection") {
      const ordered = body.orderedCatalogueWorkoutIds;
      if (!Array.isArray(ordered) || !ordered.every((x) => typeof x === "string")) {
        return NextResponse.json({ error: "orderedCatalogueWorkoutIds required" }, { status: 400 });
      }
      await saveAthleteTempoSelection({
        athletePresetId: id,
        orderedCatalogueWorkoutIds: ordered as string[],
      });
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        tempoConfirmed: true,
      });
    }

    if (body.step === "interval" && body.action === "saveSelection") {
      const ordered = body.orderedCatalogueWorkoutIds;
      if (!Array.isArray(ordered) || !ordered.every((x) => typeof x === "string")) {
        return NextResponse.json({ error: "orderedCatalogueWorkoutIds required" }, { status: 400 });
      }
      await saveAthleteIntervalsSelection({
        athletePresetId: id,
        orderedCatalogueWorkoutIds: ordered as string[],
      });
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        intervalConfirmed: true,
      });
    }

    if (body.step === "easy" && body.action === "confirm") {
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        easyConfirmed: true,
      });
    }

    if (body.step === "tempo" && body.action === "confirm") {
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        tempoConfirmed: true,
      });
    }

    if (body.step === "interval" && body.action === "confirm") {
      data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
        intervalConfirmed: true,
      });
    }

    if (body.step === "adjuster") {
      const parsed = parseAdjusterPatch(body);
      if (parsed) {
        await prisma.athlete.update({
          where: { id: auth.athlete.id },
          data: {
            ...adjusterToAthleteColumns(parsed),
            updatedAt: new Date(),
          },
        });
      }
      if (body.action === "confirm" || body.action === "defaultAdjuster") {
        if (!parsed && body.action === "defaultAdjuster") {
          await prisma.athlete.update({
            where: { id: auth.athlete.id },
            data: {
              ...adjusterToAthleteColumns(DEFAULT_ATHLETE_PACE_ADJUSTER),
              updatedAt: new Date(),
            },
          });
        }
        data.coachPlanOverview = mergeCoachPlanOverview(existing.coachPlanOverview, {
          adjusterConfirmed: true,
        });
      }
    }

    if (Object.keys(data).length <= 1) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const row = await prisma.athlete_presets.update({
      where: { id },
      data,
      include: athletePresetInclude,
    });

    return NextResponse.json({ athletePreset: serializeAthletePresetForApi(row) });
  } catch (e: unknown) {
    console.error("PATCH /api/athlete-presets/[id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update athlete preset" },
      { status: 500 }
    );
  }
}

/** DELETE /api/athlete-presets/[id] — remove draft (blocked if linked to a plan) */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const result = await deleteAthletePresetForAthlete({
      athleteId: auth.athlete.id,
      presetId: id,
    });
    if (result.deleted === false) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Athlete preset not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "This preset is linked to a training plan and cannot be deleted." },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("DELETE /api/athlete-presets/[id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete athlete preset" },
      { status: 500 }
    );
  }
}
