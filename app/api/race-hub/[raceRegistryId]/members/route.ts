export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRaceHubReadAccess } from "@/lib/race-hub/hub-read-access";

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

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const access = await assertRaceHubReadAccess(request, race.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error, code: "MEMBERSHIP_REQUIRED" }, { status: access.status });
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
