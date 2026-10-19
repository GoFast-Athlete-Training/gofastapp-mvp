export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

type Params = { params: Promise<{ id: string }> };

/** Staff DELETE — removes prod preset athletes load in setup. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const existing = await prisma.training_plan_preset.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await prisma.training_plan_preset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
