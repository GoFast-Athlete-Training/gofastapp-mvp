export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireInternalRaceHubSecret,
  requireStaffAuthorEnv,
  resolveActiveRaceByCompanyRaceId,
} from "@/lib/race-hub-internal-company";

const athleteInclude = {
  Athlete: {
    select: { id: true, firstName: true, lastName: true, photoURL: true },
  },
} as const;

/** GET — list announcements (same shape as member GET) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = requireInternalRaceHubSecret(request);
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

/** POST — create as staff sentinel author */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const unauthorized = requireInternalRaceHubSecret(request);
    if (unauthorized) return unauthorized;
    const noAuthor = requireStaffAuthorEnv();
    if (noAuthor) return noAuthor;

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const authorId = process.env.RACE_HUB_STAFF_AUTHOR_ATHLETE_ID!.trim();
    const athlete = await prisma.athlete.findUnique({ where: { id: authorId } });
    if (!athlete) {
      return NextResponse.json(
        { error: "Staff author athlete not found in database" },
        { status: 503 }
      );
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
        authorId,
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
