export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { runTypeCatalogueSelect } from "@/lib/training/run-type-config-parser";
import { distributePoolToPositions, generateCyclePoolTotals } from "@/lib/training/cycle-pool";

const includeBlock = {
  positions: {
    orderBy: { cyclePosition: "asc" as const },
    include: { workout_catalogue: { select: runTypeCatalogueSelect } },
  },
  _count: { select: { usedByPresets: true } },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;
  const { id } = await params;
  const item = await prisma.long_run_config.findUnique({
    where: { id },
    include: {
      ...includeBlock,
      usedByPresets: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!item) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const presetId = request.nextUrl.searchParams.get("presetId");
  const weeksParam = request.nextUrl.searchParams.get("weeks");
  const totalWeeks =
    weeksParam && Number.isFinite(Number(weeksParam)) && Number(weeksParam) > 0
      ? Math.floor(Number(weeksParam))
      : 16;

  let slotMilesByPhase: {
    base: ReturnType<typeof distributePoolToPositions>;
    peak: ReturnType<typeof distributePoolToPositions>;
    taper: ReturnType<typeof distributePoolToPositions>;
  } | null = null;

  if (presetId) {
    const preset = await prisma.training_plan_preset.findFirst({
      where: { id: presetId, longRunConfigId: id },
      include: { volumeConstraints: true },
    });
    if (preset?.volumeConstraints && item.positions.length > 0) {
      const v = preset.volumeConstraints;
      const { poolMilesByCycle, nCycles } = generateCyclePoolTotals({
        totalWeeks,
        cycleLen: v.cycleLen,
        peakMiles: v.peakMiles,
        taperMiles: v.taperMiles,
        buildCoef: v.buildCoef,
      });
      const posRows = item.positions.map((p) => ({
        cyclePosition: p.cyclePosition,
        distributionWeight: p.distributionWeight,
        catalogueWorkoutId: p.catalogueWorkoutId,
        name: p.workout_catalogue?.name ?? undefined,
      }));
      const basePool = poolMilesByCycle[0] ?? 0;
      const peakPool = nCycles >= 2 ? (poolMilesByCycle[nCycles - 2] ?? 0) : basePool;
      const taperPool = nCycles >= 1 ? (poolMilesByCycle[nCycles - 1] ?? 0) : 0;
      slotMilesByPhase = {
        base: distributePoolToPositions(basePool, posRows),
        peak: distributePoolToPositions(peakPool, posRows),
        taper: distributePoolToPositions(taperPool, posRows),
      };
    }
  }

  return NextResponse.json({ success: true, item, slotMilesByPhase });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;
  const { id } = await params;
  const existing = await prisma.long_run_config.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const data: { name?: string; description?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  const hasName = "name" in body;
  const hasDesc = "description" in body;
  if (!hasName && !hasDesc) {
    return NextResponse.json(
      { success: false, error: "Expected name and/or description" },
      { status: 400 }
    );
  }
  if (hasName) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ success: false, error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (hasDesc) {
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description === "string") {
      data.description = body.description.trim() || null;
    } else {
      return NextResponse.json({ success: false, error: "description must be a string or null" }, { status: 400 });
    }
  }

  const item = await prisma.long_run_config.update({
    where: { id },
    data,
    include: { ...includeBlock, usedByPresets: { select: { id: true, title: true, slug: true } } },
  });
  return NextResponse.json({ success: true, item });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(_request);
  if (authErr) return authErr;
  const { id } = await params;
  const ex = await prisma.long_run_config.findUnique({ where: { id } });
  if (!ex) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  await prisma.long_run_config.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
