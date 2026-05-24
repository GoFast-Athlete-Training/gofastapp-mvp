export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

const athleteInclude = {
  Athlete: {
    select: { id: true, firstName: true, lastName: true, photoURL: true },
  },
} as const;

/** GET — list announcements (staff Firebase auth via Company proxy) */
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

    const announcements = await prisma.race_announcements.findMany({
      where: { raceId: race.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: athleteInclude,
    });

    return NextResponse.json({ success: true, announcements });
  } catch (err) {
    console.error("internal company announcements GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — create as authenticated staff author */
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
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const announcement = await prisma.race_announcements.create({
      data: {
        raceId: race.id,
        staffGeneratedId,
        title,
        content,
      },
      include: athleteInclude,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err) {
    console.error("internal company announcements POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
