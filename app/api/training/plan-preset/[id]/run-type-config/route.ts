export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

const catalogueSelect = {
  id: true,
  name: true,
  workoutType: true,
  slug: true,
} as const;

type RunTypeRow = {
  cyclePosition: number;
  name: string;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
};

function parseRunTypeBody(raw: unknown): { ok: true; rows: RunTypeRow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Body must be a non-empty array" };
  }
  const rows: RunTypeRow[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    if (item == null || typeof item !== "object") {
      return { ok: false, error: `Invalid item at index ${i}` };
    }
    const cp = item.cyclePosition;
    if (typeof cp !== "number" || !Number.isInteger(cp) || cp < 0) {
      return { ok: false, error: `cyclePosition must be a non-negative integer (index ${i})` };
    }
    if (seen.has(cp)) {
      return { ok: false, error: `Duplicate cyclePosition ${cp}` };
    }
    seen.add(cp);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      return { ok: false, error: `name is required (index ${i})` };
    }
    const dw = item.distributionWeight;
    if (typeof dw !== "number" || !Number.isFinite(dw) || dw < 0) {
      return { ok: false, error: `distributionWeight must be a non-negative number (index ${i})` };
    }
    let catalogueWorkoutId: string | null = null;
    if (Object.prototype.hasOwnProperty.call(item, "catalogueWorkoutId")) {
      if (item.catalogueWorkoutId === null || item.catalogueWorkoutId === undefined || item.catalogueWorkoutId === "") {
        catalogueWorkoutId = null;
      } else if (typeof item.catalogueWorkoutId === "string") {
        catalogueWorkoutId = item.catalogueWorkoutId;
      } else {
        return { ok: false, error: `catalogueWorkoutId must be a string or null (index ${i})` };
      }
    }
    rows.push({ cyclePosition: cp, name, distributionWeight: dw, catalogueWorkoutId });
  }
  const sum = rows.reduce((a, r) => a + r.distributionWeight, 0);
  if (sum <= 0 || !Number.isFinite(sum)) {
    return { ok: false, error: "distributionWeight values must have a positive sum" };
  }
  return { ok: true, rows };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(_request);
  if (authErr) return authErr;

  const { id: presetId } = await params;
  const preset = await prisma.training_plan_preset.findUnique({ where: { id: presetId } });
  if (!preset) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const items = await prisma.run_type_config.findMany({
    where: { presetId },
    include: { workout_catalogue: { select: catalogueSelect } },
    orderBy: { cyclePosition: "asc" },
  });

  return NextResponse.json({ success: true, items });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: presetId } = await params;
  const preset = await prisma.training_plan_preset.findUnique({ where: { id: presetId } });
  if (!preset) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseRunTypeBody(body);
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
      await tx.run_type_config.deleteMany({ where: { presetId } });
      for (const row of parsed.rows) {
        await tx.run_type_config.create({
          data: {
            id: newEntityId(),
            presetId,
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
    console.error("PUT run-type-config", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const items = await prisma.run_type_config.findMany({
    where: { presetId },
    include: { workout_catalogue: { select: catalogueSelect } },
    orderBy: { cyclePosition: "asc" },
  });

  return NextResponse.json({ success: true, items });
}
