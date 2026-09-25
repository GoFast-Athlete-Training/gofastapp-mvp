export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

/** GET — list hub messages including staff-authored rows */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const messages = await prisma.race_messages.findMany({
      where: { raceId: race.id },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, messages, raceRegistryId: race.id });
  } catch (err) {
    console.error("internal company messages GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — staff-authored hub message */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const staffGeneratedId = getForwardedStaffId(request);
    if (!staffGeneratedId) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 401 });
    }

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const topic =
      typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : "general";
    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const message = await prisma.race_messages.create({
      data: {
        raceId: race.id,
        staffGeneratedId,
        content,
        topic,
      },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
        },
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error("internal company messages POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
