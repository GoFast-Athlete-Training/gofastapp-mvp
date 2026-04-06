import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — unseen weekly pace / review notifications for dashboard banner */
export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;
  if (id !== auth.athlete.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notifications = await prisma.pace_adjustment_log.findMany({
    where: { athleteId: id, seenAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      planId: true,
      weekNumber: true,
      previousPaceSecPerMile: true,
      newPaceSecPerMile: true,
      adjustmentSecPerMile: true,
      summaryMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ notifications });
}

/** PATCH — body: { logId: string } marks one notification seen */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;
  if (id !== auth.athlete.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const logId =
    body &&
    typeof body === "object" &&
    "logId" in body &&
    typeof (body as { logId: unknown }).logId === "string"
      ? (body as { logId: string }).logId.trim()
      : "";
  if (!logId) {
    return NextResponse.json({ error: "logId required" }, { status: 400 });
  }

  const updated = await prisma.pace_adjustment_log.updateMany({
    where: { id: logId, athleteId: id },
    data: { seenAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
