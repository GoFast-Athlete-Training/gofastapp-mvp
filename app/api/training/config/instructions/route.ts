export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const instructions = await prisma.prompt_instructions.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        training_gen_prompts: {
          select: { id: true, name: true },
        },
      },
    });

    const items = instructions.map((inst) => {
      const { training_gen_prompts, ...rest } = inst;
      return {
        ...rest,
        plantuner_training_gen_prompts: training_gen_prompts,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/config/instructions", e);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { title, content, promptId } = body;
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "Title and content are required" },
        { status: 400 }
      );
    }
    if (promptId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "promptId cannot be provided during creation. Create standalone first, then attach via PUT /api/training/config/instructions/[id]",
        },
        { status: 400 }
      );
    }
    const now = new Date();
    const instruction = await prisma.prompt_instructions.create({
      data: {
        id: newEntityId(),
        title,
        content,
        promptId: null,
        order: 0,
        updatedAt: now,
      },
      include: {
        training_gen_prompts: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      instruction: {
        ...instruction,
        plantuner_training_gen_prompts: instruction.training_gen_prompts,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/config/instructions", e);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
