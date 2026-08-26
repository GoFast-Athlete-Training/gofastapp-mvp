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
} from "@/lib/training/clone-preset-configs";
import {
  defaultPaceProfileForCapability,
  parsePaceProfile,
} from "@/lib/training/preset-strategy";

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

/** PATCH /api/athlete-presets/[id] — builder steps: core cups, workouts, pace */
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

    if (body.step === "core" || "baseMiles" in body) {
      const num = (v: unknown, fallback: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      if ("baseMiles" in body) data.baseMiles = num(body.baseMiles, existing.baseMiles);
      if ("peakMiles" in body) data.peakMiles = num(body.peakMiles, existing.peakMiles);
      if ("taperMiles" in body) data.taperMiles = num(body.taperMiles, existing.taperMiles);
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
      await cloneRotationsFromSourcePreset({
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

    if (body.step === "pace" || "paceProfile" in body) {
      if ("paceProfile" in body) {
        if (body.paceProfile === null) {
          data.paceProfile = Prisma.JsonNull;
        } else {
          const parsed = parsePaceProfile(body.paceProfile);
          if (!parsed) {
            return NextResponse.json({ error: "Invalid paceProfile" }, { status: 400 });
          }
          data.paceProfile = parsed as Prisma.InputJsonValue;
        }
      } else if (body.action === "defaultPace") {
        const source = existing.sourcePresetId
          ? await prisma.training_plan_preset.findUnique({
              where: { id: existing.sourcePresetId },
              select: { paceProfile: true, athletePersonaCapability: true, easyRunConfig: true },
            })
          : null;
        const parsed = source?.paceProfile
          ? parsePaceProfile(source.paceProfile)
          : defaultPaceProfileForCapability(source?.athletePersonaCapability ?? null);
        data.paceProfile = (parsed ?? defaultPaceProfileForCapability(null)) as Prisma.InputJsonValue;
        if (source?.easyRunConfig) {
          data.easyRunConfig = source.easyRunConfig as Prisma.InputJsonValue;
        }
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
