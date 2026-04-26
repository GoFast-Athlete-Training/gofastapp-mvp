export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import {
  parseRunTypePositionsBody,
  runTypeCatalogueSelect,
} from "@/lib/training/run-type-config-parser";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: runTypeConfigId } = await params;
  const parent = await prisma.run_type_config.findUnique({ where: { id: runTypeConfigId } });
  if (!parent) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseRunTypePositionsBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const ids = new Set(
    parsed.rows
      .map((r) => r.catalogueWorkoutId)
      .filter((x): x is string => x != null && x.length > 0)
  );
  if (ids.size > 0) {
    const found = await prisma.workout_catalogue.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });
    if (found.length !== ids.size) {
      return NextResponse.json(
        { success: false, error: "One or more catalogueWorkoutId values are invalid" },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.run_type_config_position.deleteMany({ where: { runTypeConfigId } });
      for (const row of parsed.rows) {
        await tx.run_type_config_position.create({
          data: {
            id: newEntityId(),
            runTypeConfigId,
            cyclePosition: row.cyclePosition,
            name: row.name,
            distributionWeight: row.distributionWeight,
            catalogueWorkoutId: row.catalogueWorkoutId,
            updatedAt: now,
          },
        });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PUT run-type-config/positions", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const items = await prisma.run_type_config_position.findMany({
    where: { runTypeConfigId },
    include: { workout_catalogue: { select: runTypeCatalogueSelect } },
    orderBy: { cyclePosition: "asc" },
  });

  return NextResponse.json({ success: true, items });
}
