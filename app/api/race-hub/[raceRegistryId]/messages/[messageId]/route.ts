export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

/** PATCH /api/race-hub/[raceRegistryId]/messages/[messageId] — author only */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string; messageId: string }> }
) {
  try {
    const { raceRegistryId, messageId } = await params;
    if (!raceRegistryId?.trim() || !messageId?.trim()) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const membership = await requireRaceMembership(auth.athlete.id, raceRegistryId.trim());
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.race_messages.findFirst({
      where: { id: messageId.trim(), raceId: raceRegistryId.trim() },
    });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (existing.athleteId !== auth.athlete.id) {
      return NextResponse.json({ error: "Only author can edit" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const content =
      typeof body.content === "string" ? body.content.trim() : undefined;
    const topic =
      typeof body.topic === "string" && body.topic.trim()
        ? body.topic.trim()
        : undefined;

    if (!content && !topic) {
      return NextResponse.json({ error: "content or topic required" }, { status: 400 });
    }

    const message = await prisma.race_messages.update({
      where: { id: messageId.trim() },
      data: {
        ...(content !== undefined ? { content } : {}),
        ...(topic !== undefined ? { topic } : {}),
      },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
        },
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error("race message PATCH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE — author only */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string; messageId: string }> }
) {
  try {
    const { raceRegistryId, messageId } = await params;
    if (!raceRegistryId?.trim() || !messageId?.trim()) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const membership = await requireRaceMembership(auth.athlete.id, raceRegistryId.trim());
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.race_messages.findFirst({
      where: { id: messageId.trim(), raceId: raceRegistryId.trim() },
    });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (existing.athleteId !== auth.athlete.id) {
      return NextResponse.json({ error: "Only author can delete" }, { status: 403 });
    }

    await prisma.race_messages.delete({ where: { id: messageId.trim() } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("race message DELETE:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
