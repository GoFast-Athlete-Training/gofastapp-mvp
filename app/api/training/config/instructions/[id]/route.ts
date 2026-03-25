export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

type Ctx = { params: Promise<{ id: string }> };

function mapInstruction(inst: {
  id: string;
  promptId: string | null;
  title: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  training_gen_prompts: { id: string; name: string } | null;
}) {
  const { training_gen_prompts, ...rest } = inst;
  return {
    ...rest,
    plantuner_training_gen_prompts: training_gen_prompts,
  };
}

export async function GET(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    const instruction = await prisma.prompt_instructions.findUnique({
      where: { id },
      include: {
        training_gen_prompts: { select: { id: true, name: true } },
      },
    });
    if (!instruction) {
      return NextResponse.json(
        { success: false, error: "Instruction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      instruction: mapInstruction(instruction),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { title, content, promptId, order } = body;

    if (promptId !== undefined) {
      if (promptId !== null) {
        const prompt = await prisma.training_gen_prompts.findUnique({
          where: { id: promptId },
        });
        if (!prompt) {
          return NextResponse.json(
            { success: false, error: "Prompt not found" },
            { status: 404 }
          );
        }
        let finalOrder = order;
        if (finalOrder === undefined) {
          const existingCount = await prisma.prompt_instructions.count({
            where: { promptId },
          });
          finalOrder = existingCount;
        }
        const instruction = await prisma.prompt_instructions.update({
          where: { id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            promptId,
            order: finalOrder,
            updatedAt: new Date(),
          },
          include: {
            training_gen_prompts: { select: { id: true, name: true } },
          },
        });
        return NextResponse.json({
          success: true,
          instruction: mapInstruction(instruction),
        });
      }
      const instruction = await prisma.prompt_instructions.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          promptId: null,
          order: 0,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, instruction });
    }

    const instruction = await prisma.prompt_instructions.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
        updatedAt: new Date(),
      },
      include: {
        training_gen_prompts: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({
      success: true,
      instruction: mapInstruction(instruction),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    await prisma.prompt_instructions.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
