export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

/** GET /api/race-hub/[raceRegistryId]/members — hub members only */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> }
) {
  try {
    const { raceRegistryId } = await params;
    if (!raceRegistryId?.trim()) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json(
        { error: "Join this race hub to view members", code: "MEMBERSHIP_REQUIRED" },
        { status: 403 }
      );
    }

    const memberships = await prisma.race_memberships.findMany({
      where: { raceId: race.id },
      orderBy: { joinedAt: "asc" },
      include: {
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gofastHandle: true,
            photoURL: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, memberships });
  } catch (err) {
    console.error("race-hub members GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
