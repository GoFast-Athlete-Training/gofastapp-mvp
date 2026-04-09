export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireInternalRaceHubSecret,
  resolveActiveRaceByCompanyRaceId,
} from "@/lib/race-hub-internal-company";

const athleteInclude = {
  Athlete: {
    select: { id: true, firstName: true, lastName: true, photoURL: true },
  },
} as const;

/** PUT — staff editorial update (no author check) */
export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ companyRaceId: string; announcementId: string }> }
) {
  try {
    const unauthorized = requireInternalRaceHubSecret(request);
    if (unauthorized) return unauthorized;

    const { companyRaceId, announcementId } = await params;
    const cid = companyRaceId?.trim();
    const aid = announcementId?.trim();
    if (!cid || !aid) {
      return NextResponse.json(
        { error: "companyRaceId and announcementId required" },
        { status: 400 }
      );
    }

    const race = await resolveActiveRaceByCompanyRaceId(cid);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const existing = await prisma.race_announcements.findFirst({
      where: { id: aid, raceId: race.id, archivedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const titleRaw = typeof body.title === "string" ? body.title.trim() : undefined;
    const contentRaw = typeof body.content === "string" ? body.content.trim() : undefined;

    if (titleRaw === undefined && contentRaw === undefined) {
      return NextResponse.json({ error: "title or content required" }, { status: 400 });
    }
    if (titleRaw !== undefined && titleRaw.length === 0) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    if (contentRaw !== undefined && contentRaw.length === 0) {
      return NextResponse.json({ error: "content cannot be empty" }, { status: 400 });
    }

    const announcement = await prisma.race_announcements.update({
      where: { id: aid },
      data: {
        ...(titleRaw !== undefined ? { title: titleRaw } : {}),
        ...(contentRaw !== undefined ? { content: contentRaw } : {}),
      },
      include: athleteInclude,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err) {
    console.error("internal company announcement PUT:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
