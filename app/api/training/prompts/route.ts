export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

function mapPromptList(p: {
  id: string;
  name: string;
  description: string | null;
  ai_roles: { id: string; name: string } | null;
  rule_sets: { id: string; name: string } | null;
  must_haves: { id: string; name: string } | null;
  return_json_formats: { id: string; name: string } | null;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    aiRole: p.ai_roles ? { id: p.ai_roles.id, name: p.ai_roles.name } : null,
    ruleSet: p.rule_sets ? { id: p.rule_sets.id, name: p.rule_sets.name } : null,
    mustHaves: p.must_haves ? { id: p.must_haves.id, name: p.must_haves.name } : null,
    returnFormat: p.return_json_formats
      ? { id: p.return_json_formats.id, name: p.return_json_formats.name }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const prompts = await prisma.training_gen_prompts.findMany({
      include: {
        ai_roles: true,
        rule_sets: true,
        must_haves: true,
        return_json_formats: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      success: true,
      prompts: prompts.map(mapPromptList),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/prompts", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { name, description, aiRoleId, ruleSetId, mustHavesId, returnFormatId } =
      body;
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }
    let resolvedAi = aiRoleId as string | null | undefined;
    let resolvedMust = mustHavesId as string | null | undefined;
    let resolvedRet = returnFormatId as string | null | undefined;
    if (!resolvedAi) {
      const first = await prisma.ai_roles.findFirst({ orderBy: { createdAt: "desc" } });
      resolvedAi = first?.id;
    }
    if (!resolvedMust) {
      const first = await prisma.must_haves.findFirst({ orderBy: { createdAt: "desc" } });
      resolvedMust = first?.id;
    }
    if (!resolvedRet) {
      const first = await prisma.return_json_formats.findFirst({
        orderBy: { createdAt: "desc" },
      });
      resolvedRet = first?.id;
    }
    if (!resolvedAi || !resolvedMust || !resolvedRet) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing aiRoleId, mustHavesId, or returnFormatId and no defaults exist in the database",
        },
        { status: 400 }
      );
    }
    const now = new Date();
    const prompt = await prisma.training_gen_prompts.create({
      data: {
        id: newEntityId(),
        name,
        description: description ?? null,
        aiRoleId: resolvedAi,
        ruleSetId: ruleSetId ?? null,
        mustHavesId: resolvedMust,
        returnFormatId: resolvedRet,
        updatedAt: now,
      },
    });
    return NextResponse.json({ success: true, prompt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/prompts", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 }
      );
    }
    await prisma.prompt_instructions.deleteMany({ where: { promptId: id } });
    await prisma.training_gen_prompts.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/training/prompts", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
