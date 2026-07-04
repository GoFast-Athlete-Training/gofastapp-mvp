import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { joinTrainingCohort } from "@/lib/training/cohort-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/race-trainer/[groupId]/join
 * Join a training cohort — creates membership + follower training plan.
 * Body: { goalTime, replaceActivePlan? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { groupId: cohortId } = await params;
    if (!cohortId?.trim()) {
      return NextResponse.json(
        { success: false, error: "groupId required" },
        { status: 400 }
      );
    }

    let body: { goalTime?: string; replaceActivePlan?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }

    const result = await joinTrainingCohort({
      cohortId: cohortId.trim(),
      athleteId: auth.athlete.id,
      goalTime: body.goalTime,
      replaceActivePlan: body.replaceActivePlan === true,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("❌ RACE-TRAINER JOIN POST:", error);
    const message = error instanceof Error ? error.message : "Failed to join trainer group";
    const status = message.includes("active training plan") ? 409 : 400;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
