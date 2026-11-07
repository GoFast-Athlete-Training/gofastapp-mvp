import { getAthleteCauseForOwner } from "@/lib/athlete-causes/athlete-cause-service";
import { normalizeCauseWebsiteUrl } from "@/lib/athlete-causes/cause-url";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function serialize(c: NonNullable<Awaited<ReturnType<typeof getAthleteCauseForOwner>>>) {
  return {
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    logoUrl: c.logoUrl,
    note: c.note,
    raceRegistryId: c.raceRegistryId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const existing = await getAthleteCauseForOwner(gate.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Cause not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    name?: string;
    websiteUrl?: string;
    logoUrl?: string | null;
    note?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "name cannot be empty" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.websiteUrl !== undefined) {
    const normalized = normalizeCauseWebsiteUrl(String(body.websiteUrl));
    if (!normalized) {
      return NextResponse.json({ success: false, error: "Invalid website URL" }, { status: 400 });
    }
    const dup = await prisma.athlete_causes.findFirst({
      where: {
        athleteId: gate.athlete.id,
        websiteUrl: normalized,
        id: { not: id },
      },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "You already have a cause with that website URL" },
        { status: 400 },
      );
    }
    data.websiteUrl = normalized;
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = body.logoUrl === null ? null : String(body.logoUrl).trim() || null;
  }
  if (body.note !== undefined) {
    data.note = body.note === null ? null : String(body.note).trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const row = await prisma.athlete_causes.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, cause: serialize(row) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const existing = await getAthleteCauseForOwner(gate.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Cause not found" }, { status: 404 });
  }

  await prisma.athlete_causes.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
