export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { runTypeCatalogueSelect } from "@/lib/training/run-type-config-parser";

const includeBlock = {
  positions: {
    orderBy: { cyclePosition: "asc" as const },
    include: { workout_catalogue: { select: runTypeCatalogueSelect } },
  },
  _count: { select: { usedByPresets: true } },
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(_request);
  if (authErr) return authErr;
  const { id } = await params;
  const item = await prisma.run_type_config.findUnique({
    where: { id },
    include: {
      ...includeBlock,
      usedByPresets: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!item) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, item });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;
  const { id } = await params;
  const existing = await prisma.run_type_config.findUnique({ where: { id } });
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
    return NextResponse.json({ success: false, error: "Expected name and/or description" }, { status: 400 });
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

  const item = await prisma.run_type_config.update({
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
  const ex = await prisma.run_type_config.findUnique({ where: { id } });
  if (!ex) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  await prisma.run_type_config.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
