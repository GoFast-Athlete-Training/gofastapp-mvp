import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/race-trainer/[groupId]/join
 * Join a race trainer group.
 * Body: { userId, role? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const group = await prisma.race_trainer_groups.findUnique({
      where: { id: groupId },
    });

    if (!group || !group.isActive) {
      return NextResponse.json(
        { success: false, error: "Race trainer group not found or inactive" },
        { status: 404 }
      );
    }

    // Upsert membership (idempotent)
    const member = await prisma.race_trainer_members.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: {
        groupId,
        userId,
        role: role || "MEMBER",
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    console.error("❌ RACE-TRAINER JOIN POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to join trainer group", details: error?.message },
      { status: 500 }
    );
  }
}
