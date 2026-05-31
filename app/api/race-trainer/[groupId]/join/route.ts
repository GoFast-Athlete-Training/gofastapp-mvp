import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TrainingCohortRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const COHORT_ROLES = new Set<TrainingCohortRole>(["MEMBER", "PACER", "ADMIN"]);

/**
 * POST /api/race-trainer/[groupId]/join
 * Join a training cohort.
 * Body: { userId (athleteId), role? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId: cohortId } = await params;
    const body = await request.json();
    const athleteId = body.athleteId ?? body.userId;
    const role: TrainingCohortRole =
      COHORT_ROLES.has(body.role) ? body.role : "MEMBER";

    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: "athleteId (or userId) is required" },
        { status: 400 }
      );
    }

    const cohort = await prisma.training_cohorts.findUnique({
      where: { id: cohortId },
    });

    if (!cohort || (cohort.status !== "OPEN" && cohort.status !== "ACTIVE")) {
      return NextResponse.json(
        { success: false, error: "Training cohort not found or not joinable" },
        { status: 404 }
      );
    }

    const member = await prisma.training_cohort_memberships.upsert({
      where: { cohortId_athleteId: { cohortId, athleteId } },
      update: {},
      create: {
        cohortId,
        raceId: cohort.raceId,
        athleteId,
        role,
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error: unknown) {
    console.error("❌ RACE-TRAINER JOIN POST:", error);
    const message = error instanceof Error ? error.message : "Failed to join trainer group";
    return NextResponse.json(
      { success: false, error: "Failed to join trainer group", details: message },
      { status: 500 }
    );
  }
}
