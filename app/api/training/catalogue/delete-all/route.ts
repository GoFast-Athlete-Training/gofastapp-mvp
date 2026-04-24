export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

export async function DELETE(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const result = await prisma.workout_catalogue.deleteMany({});
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/training/catalogue/delete-all", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
