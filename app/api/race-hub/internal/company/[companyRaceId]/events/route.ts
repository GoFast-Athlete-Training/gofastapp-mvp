export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

const organizerInclude = {
  organizer: {
    select: { id: true, firstName: true, lastName: true, photoURL: true },
  },
} as const;

/** GET — list hub events including staff-authored rows */
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

    const events = await prisma.race_events.findMany({
      where: { raceId: race.id },
      orderBy: { date: "asc" },
      include: organizerInclude,
    });

    return NextResponse.json({ success: true, events, raceRegistryId: race.id });
  } catch (err) {
    console.error("internal company events GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — staff-authored hub event */
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
    const time = typeof body.time === "string" ? body.time.trim() : "";
    const venue = typeof body.venue === "string" ? body.venue.trim() : "";
    const dateRaw = body.date;
    const date =
      typeof dateRaw === "string" || dateRaw instanceof Date
        ? new Date(dateRaw)
        : null;

    if (!title || !time || !venue || !date || Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "title, time, venue, and valid date required" },
        { status: 400 }
      );
    }

    const address = typeof body.address === "string" ? body.address.trim() || null : null;
    const description =
      typeof body.description === "string" ? body.description.trim() || null : null;
    const additionalDetails =
      typeof body.additionalDetails === "string"
        ? body.additionalDetails.trim() || null
        : null;
    const cost =
      typeof body.cost === "number" && Number.isFinite(body.cost)
        ? Math.floor(body.cost)
        : null;

    const event = await prisma.race_events.create({
      data: {
        raceId: race.id,
        staffGeneratedId,
        title,
        date,
        time,
        venue,
        address,
        description,
        additionalDetails,
        cost,
      },
      include: organizerInclude,
    });

    return NextResponse.json({ success: true, event });
  } catch (err) {
    console.error("internal company events POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
