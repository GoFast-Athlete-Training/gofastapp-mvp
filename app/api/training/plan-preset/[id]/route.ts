export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseRaceWeekDayMiles } from "@/lib/training/apply-preset-owned-phase";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import {
  serializeStaffPlanPreset,
  staffPlanPresetInclude,
} from "@/lib/training/preset-staff-serialize";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

type Params = { params: Promise<{ id: string }> };

function linkBuildPresetId(body: Record<string, unknown>): string | null | undefined {
  if ("buildPresetId" in body) {
    return typeof body.buildPresetId === "string" && body.buildPresetId ? body.buildPresetId : null;
  }
  if ("buildConfigId" in body) {
    return typeof body.buildConfigId === "string" && body.buildConfigId ? body.buildConfigId : null;
  }
  return undefined;
}

function linkTaperPresetId(body: Record<string, unknown>): string | null | undefined {
  if ("taperPresetId" in body) {
    return typeof body.taperPresetId === "string" && body.taperPresetId ? body.taperPresetId : null;
  }
  if ("taperConfigId" in body) {
    return typeof body.taperConfigId === "string" && body.taperConfigId ? body.taperConfigId : null;
  }
  return undefined;
}

/** Staff GET — one preset for Training Manage wizard (prod SOT). */
export async function GET(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const row = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: staffPlanPresetInclude,
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: serializeStaffPlanPreset(row) });
}

/** Staff PATCH — scalar + phase link updates on prod. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const existing = await prisma.training_plan_preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    data.title = title;
    if (title) {
      const nextSlug = normalizeSlug(title).slice(0, 80);
      if (nextSlug) data.slug = nextSlug;
    }
  }
  if (typeof body.description === "string") data.description = body.description.trim();
  if (body.description === null) data.description = null;
  if (typeof body.publicDescription === "string") {
    data.publicDescription = body.publicDescription.trim();
  }
  if (body.publicDescription === null) data.publicDescription = null;
  if (typeof body.targetDistanceLabel === "string") {
    data.targetDistanceLabel = body.targetDistanceLabel.trim() || null;
  }
  if (body.targetDistanceLabel === null) data.targetDistanceLabel = null;
  if (typeof body.minWeeklyMiles === "number" && Number.isFinite(body.minWeeklyMiles)) {
    data.minWeeklyMiles = Math.max(1, Math.round(body.minWeeklyMiles));
  }
  if (body.maxWeeklyMiles === null) data.maxWeeklyMiles = null;
  if (typeof body.maxWeeklyMiles === "number" && Number.isFinite(body.maxWeeklyMiles)) {
    data.maxWeeklyMiles = Math.max(1, Math.round(body.maxWeeklyMiles));
  }
  if (typeof body.paceNudgeSecPerMile === "number" && Number.isFinite(body.paceNudgeSecPerMile)) {
    data.paceNudgeSecPerMile = Math.max(-180, Math.min(180, Math.round(body.paceNudgeSecPerMile)));
  }
  if (typeof body.coachIntent === "string") data.coachIntent = body.coachIntent.trim();
  if (body.coachIntent === null) data.coachIntent = null;
  if ("personaId" in body) {
    data.personaId =
      typeof body.personaId === "string" && body.personaId.trim() ? body.personaId.trim() : null;
  }
  if ("goalId" in body) {
    data.goalId = typeof body.goalId === "string" && body.goalId.trim() ? body.goalId.trim() : null;
  }

  if ("baseBuildPresetId" in body) {
    if (body.baseBuildPresetId === null || body.baseBuildPresetId === "") {
      data.baseBuildPresetId = null;
    } else if (typeof body.baseBuildPresetId === "string" && body.baseBuildPresetId.trim()) {
      const build = await prisma.build_preset.findUnique({
        where: { id: body.baseBuildPresetId.trim() },
      });
      if (!build) {
        return NextResponse.json(
          { success: false, error: "Base build preset not found" },
          { status: 404 },
        );
      }
      data.baseBuildPresetId = build.id;
    }
  }

  const buildId = linkBuildPresetId(body);
  if (buildId !== undefined) {
    if (buildId === null) {
      data.buildPresetId = null;
    } else {
      const build = await prisma.build_preset.findUnique({ where: { id: buildId } });
      if (!build) {
        return NextResponse.json({ success: false, error: "Build preset not found" }, { status: 404 });
      }
      data.buildPresetId = build.id;
    }
  }

  const taperId = linkTaperPresetId(body);
  if (taperId !== undefined) {
    if (taperId === null) {
      data.taperPresetId = null;
    } else {
      const taper = await prisma.taper_preset.findUnique({ where: { id: taperId } });
      if (!taper) {
        return NextResponse.json({ success: false, error: "Taper preset not found" }, { status: 404 });
      }
      data.taperPresetId = taper.id;
    }
  }

  function optionalMiles(key: string): number | null | undefined {
    if (!(key in body)) return undefined;
    if (body[key] === null || body[key] === "") return null;
    if (typeof body[key] === "number" && Number.isFinite(body[key])) return body[key];
    return undefined;
  }

  for (const key of [
    "entryLongRunMiles",
    "peakLongRunMiles",
    "baseEndLongRunMiles",
    "longRunCutback",
    "taperWeek1TotalMiles",
    "taperWeek1LongRunMiles",
    "taperWeek2TotalMiles",
    "taperWeek2LongRunMiles",
  ] as const) {
    const value = optionalMiles(key);
    if (value !== undefined) data[key] = value;
  }
  const baseEndWeekly = optionalMiles("baseEndWeeklyMiles");
  if (baseEndWeekly !== undefined) {
    data.baseEndWeeklyMiles = baseEndWeekly == null ? null : Math.round(baseEndWeekly);
  }
  if ("raceWeekDayMiles" in body) {
    if (body.raceWeekDayMiles == null) {
      data.raceWeekDayMiles = Prisma.DbNull;
    } else {
      const parsed = parseRaceWeekDayMiles(body.raceWeekDayMiles);
      data.raceWeekDayMiles = parsed ?? [];
    }
  }

  for (const key of [
    "baseBuildPhasePresetId",
    "buildToPeakPhasePresetId",
    "taperPhasePresetId",
    "raceWeekPhasePresetId",
  ] as const) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
      continue;
    }
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json({ success: false, error: "Phase preset id is invalid" }, { status: 400 });
    }
    const phase = await prisma.phase_preset.findUnique({ where: { id: raw.trim() } });
    if (!phase) {
      return NextResponse.json({ success: false, error: "Phase preset not found" }, { status: 404 });
    }
    data[key] = phase.id;
  }

  if ("raceWeekPresetId" in body) {
    if (typeof body.raceWeekPresetId !== "string" || !body.raceWeekPresetId) {
      data.raceWeekPresetId = null;
    } else {
      const raceWeek = await prisma.race_week_preset.findUnique({
        where: { id: body.raceWeekPresetId },
      });
      if (!raceWeek) {
        return NextResponse.json({ success: false, error: "Race week preset not found" }, { status: 404 });
      }
      data.raceWeekPresetId = raceWeek.id;
    }
  }

  const row = await prisma.training_plan_preset.update({
    where: { id },
    data,
    include: staffPlanPresetInclude,
  });

  return NextResponse.json({ success: true, preset: serializeStaffPlanPreset(row) });
}

/** Staff DELETE — removes prod preset athletes load in setup. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const existing = await prisma.training_plan_preset.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await prisma.training_plan_preset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
