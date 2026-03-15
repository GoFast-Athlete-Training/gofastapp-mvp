import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/race-trainer/[groupId]/leave
 * Leave a race trainer group.
 * Body: { userId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    await prisma.race_trainer_members.deleteMany({
      where: { groupId, userId },
    });

    return NextResponse.json({ success: true, message: "Left trainer group" });
  } catch (error: any) {
    console.error("❌ RACE-TRAINER LEAVE POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to leave trainer group", details: error?.message },
      { status: 500 }
    );
  }
}
