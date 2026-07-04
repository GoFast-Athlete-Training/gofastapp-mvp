export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/training-cohorts/membership?cohortId= — current athlete membership status */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const cohortId = request.nextUrl.searchParams.get("cohortId")?.trim();
    if (!cohortId) {
      return NextResponse.json({ error: "cohortId required" }, { status: 400 });
    }

    const member = await prisma.training_cohort_memberships.findUnique({
      where: {
        cohortId_athleteId: { cohortId, athleteId: auth.athlete.id },
      },
      select: {
        id: true,
        role: true,
        trainingPlanId: true,
        joinedAt: true,
      },
    });

    const cohort = await prisma.training_cohorts.findUnique({
      where: { id: cohortId },
      select: { hostAthleteId: true },
    });

    return NextResponse.json({
      isMember: !!member,
      isHost: cohort?.hostAthleteId === auth.athlete.id,
      membership: member,
    });
  } catch (e) {
    console.error("GET /api/training-cohorts/membership:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
