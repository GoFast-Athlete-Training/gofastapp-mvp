export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function GET(_request: NextRequest) {
  const authErr = await assertStaffBearerAuth(_request);
  if (authErr) return authErr;

  const list = await prisma.intervals_config.findMany({
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

  let body: { name?: string; description?: string | null } = {};
  try {
    body = (await request.json()) as { name?: string; description?: string | null };
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
  const now = new Date();
  const id = newEntityId();
  const config = await prisma.intervals_config.create({
    data: {
      id,
      name: name,
      description: desc,
      updatedAt: now,
    },
    include: {
      _count: { select: { positions: true, usedByPresets: true } },
    },
  });
  return NextResponse.json({ success: true, item: config });
}
