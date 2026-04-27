export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";
import { WorkoutType } from "@prisma/client";

const VALID_WORKOUT_TYPE = new Set<string>(Object.values(WorkoutType));

function parseWorkoutType(v: unknown): WorkoutType | null {
  if (typeof v === "string" && VALID_WORKOUT_TYPE.has(v)) {
    return v as WorkoutType;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const list = await prisma.run_type_config.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { positions: true, usedByPresets: true },
      },
    },
  });
  return NextResponse.json({ success: true, items: list });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  let body: { name?: string; description?: string | null; workoutType?: unknown } = {};
  try {
    body = (await request.json()) as {
      name?: string;
      description?: string | null;
      workoutType?: unknown;
    };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }
  const desc =
    body.description == null
      ? null
      : typeof body.description === "string"
        ? body.description.trim() || null
        : null;
  let workoutType: WorkoutType = WorkoutType.LongRun;
  if (body.workoutType !== undefined) {
    const w = parseWorkoutType(body.workoutType);
    if (w == null) {
      return NextResponse.json({ success: false, error: "Invalid workoutType" }, { status: 400 });
    }
    workoutType = w;
  }
  const now = new Date();
  const id = newEntityId();
  const config = await prisma.run_type_config.create({
    data: {
      id,
      name: name,
      description: desc,
      workoutType,
      updatedAt: now,
    },
    include: {
      _count: { select: { positions: true, usedByPresets: true } },
    },
  });
  return NextResponse.json({ success: true, item: config });
}
