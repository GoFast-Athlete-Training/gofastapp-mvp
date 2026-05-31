import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/race-trainer/[groupId]/leave
 * Leave a training cohort.
 * Body: { userId (athleteId) }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId: cohortId } = await params;
    const body = await request.json();
    const athleteId = body.athleteId ?? body.userId;

    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: "athleteId (or userId) is required" },
        { status: 400 }
      );
    }

    await prisma.training_cohort_memberships.deleteMany({
      where: { cohortId, athleteId },
    });

    return NextResponse.json({ success: true, message: "Left trainer group" });
  } catch (error: unknown) {
    console.error("❌ RACE-TRAINER LEAVE POST:", error);
    const message = error instanceof Error ? error.message : "Failed to leave trainer group";
    return NextResponse.json(
      { success: false, error: "Failed to leave trainer group", details: message },
      { status: 500 }
    );
  }
}
