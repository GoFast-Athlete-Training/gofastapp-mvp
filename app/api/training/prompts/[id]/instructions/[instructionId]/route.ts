export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

type Ctx = { params: Promise<{ id: string; instructionId: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { instructionId } = await context.params;
    const body = await request.json();
    const { title, content, order } = body;
    const instruction = await prisma.prompt_instructions.update({
      where: { id: instructionId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, instruction });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { instructionId } = await context.params;
    await prisma.prompt_instructions.delete({ where: { id: instructionId } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
