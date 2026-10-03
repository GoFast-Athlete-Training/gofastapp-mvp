export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/** GET — race hub memberships for staff (Company / Race Manage proxy). */
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
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      raceRegistryId: race.id,
      memberships: memberships.map((m) => ({
        id: m.id,
        athleteId: m.athleteId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        Athlete: m.Athlete,
      })),
    });
  } catch (err) {
    console.error("internal company members GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
