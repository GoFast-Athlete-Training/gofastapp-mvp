export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import {
  parseRunTypePositionsBody,
  runTypeCatalogueSelect,
} from "@/lib/training/run-type-config-parser";
import { validateRunTypePositionsForSave } from "@/lib/training/run-type-config-validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: intervalsConfigId } = await params;
  const parent = await prisma.intervals_config.findUnique({ where: { id: intervalsConfigId } });
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

  const validated = await validateRunTypePositionsForSave({
    rows: parsed.rows,
    configLabel: "Intervals config",
    expectedWorkoutType: "Intervals",
  });
  if (!validated.ok) {
    return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.intervals_config_position.deleteMany({ where: { intervalsConfigId } });
      for (const row of parsed.rows) {
        await tx.intervals_config_position.create({
          data: {
            id: newEntityId(),
            intervalsConfigId,
            cyclePosition: row.cyclePosition,
            distributionWeight: row.distributionWeight,
            catalogueWorkoutId: row.catalogueWorkoutId,
            updatedAt: now,
          },
        });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PUT intervals-config/positions", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const items = await prisma.intervals_config_position.findMany({
    where: { intervalsConfigId },
    include: { workout_catalogue: { select: runTypeCatalogueSelect } },
    orderBy: { cyclePosition: "asc" },
  });

  return NextResponse.json({ success: true, items });
}
