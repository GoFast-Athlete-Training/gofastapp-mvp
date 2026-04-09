export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { assertRaceAdmin } from "@/lib/race-container-membership";

const athleteSelect = {
  select: { id: true, firstName: true, lastName: true, photoURL: true },
} as const;

/** PUT /api/race-hub/[raceRegistryId]/announcements/[announcementId] — admin or author */
export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ raceRegistryId: string; announcementId: string }> }
) {
  try {
    const { raceRegistryId, announcementId } = await params;
    const rid = raceRegistryId?.trim();
    const aid = announcementId?.trim();
    if (!rid || !aid) {
      return NextResponse.json({ error: "raceRegistryId and announcementId required" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: rid, isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const existing = await prisma.race_announcements.findFirst({
      where: { id: aid, raceId: race.id, archivedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const admin = await assertRaceAdmin(auth.athlete.id, rid);
    const isAuthor = existing.authorId === auth.athlete.id;
    if (!admin && !isAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      include: { Athlete: athleteSelect },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err) {
    console.error("race announcement PUT:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
