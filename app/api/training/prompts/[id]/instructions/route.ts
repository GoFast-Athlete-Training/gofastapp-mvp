export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id: promptId } = await context.params;
    const instructions = await prisma.prompt_instructions.findMany({
      where: { promptId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ success: true, instructions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id: promptId } = await context.params;
    const body = await request.json();
    const { title, content, order } = body;
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "Title and content are required" },
        { status: 400 }
      );
    }
    const prompt = await prisma.training_gen_prompts.findUnique({
      where: { id: promptId },
    });
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt not found" },
        { status: 404 }
      );
    }
    const now = new Date();
    const instruction = await prisma.prompt_instructions.create({
      data: {
        id: newEntityId(),
        promptId,
        title,
        content,
        order: order ?? 0,
        updatedAt: now,
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
