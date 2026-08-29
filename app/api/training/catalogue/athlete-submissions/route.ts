export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const workoutType = request.nextUrl.searchParams.get("workoutType")?.trim();
    const items = await prisma.workout_catalogue.findMany({
      where: {
        ownerAthleteId: { not: null },
        ...(workoutType
          ? { workoutType: workoutType as import("@prisma/client").WorkoutType }
          : {}),
      },
      include: {
        ownerAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            gofastHandle: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    return NextResponse.json({ success: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/catalogue/athlete-submissions", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
