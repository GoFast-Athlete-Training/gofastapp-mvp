export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

type Ctx = { params: Promise<{ id: string }> };

function shareUrlForSlug(slug: string, request: NextRequest): string {
  const origin =
    request.headers.get("x-forwarded-host") != null
      ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;
  return `${origin}/join/scheduled-run/${slug}`;
}

/**
 * GET /api/training/schedule-run/[id]
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;
    const { id } = await params;

    const row = await prisma.scheduled_runs.findFirst({
      where: { id, athleteId: athlete.id },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      scheduledRun: {
        ...row,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        shareUrl: row.shareSlug ? shareUrlForSlug(row.shareSlug, request) : null,
        joinPath: row.shareSlug ? `/join/scheduled-run/${row.shareSlug}` : null,
      },
    });
  } catch (e: unknown) {
    console.error("GET /api/training/schedule-run/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/training/schedule-run/[id]
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;
    const { id } = await params;

    const row = await prisma.scheduled_runs.findFirst({
      where: { id, athleteId: athlete.id },
      select: { id: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.scheduled_runs.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("DELETE /api/training/schedule-run/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
