export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

type Ctx = { params: Promise<{ id: string }> };

function mapPromptDetail(p: {
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

export async function GET(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    const prompt = await prisma.training_gen_prompts.findUnique({
      where: { id },
      include: {
        ai_roles: true,
        rule_sets: true,
        must_haves: true,
        return_json_formats: true,
      },
    });
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      prompt: mapPromptDetail(prompt),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, description, aiRoleId, ruleSetId, mustHavesId, returnFormatId } =
      body;

    if (aiRoleId !== undefined && !aiRoleId) {
      return NextResponse.json(
        { success: false, error: "aiRoleId cannot be cleared" },
        { status: 400 }
      );
    }
    if (mustHavesId !== undefined && !mustHavesId) {
      return NextResponse.json(
        { success: false, error: "mustHavesId cannot be cleared" },
        { status: 400 }
      );
    }
    if (returnFormatId !== undefined && !returnFormatId) {
      return NextResponse.json(
        { success: false, error: "returnFormatId cannot be cleared" },
        { status: 400 }
      );
    }

    const prompt = await prisma.training_gen_prompts.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description ?? null }),
        ...(aiRoleId !== undefined && { aiRoleId }),
        ...(ruleSetId !== undefined && { ruleSetId: ruleSetId || null }),
        ...(mustHavesId !== undefined && { mustHavesId }),
        ...(returnFormatId !== undefined && { returnFormatId }),
      },
      include: {
        ai_roles: true,
        rule_sets: true,
        must_haves: true,
        return_json_formats: true,
      },
    });

    return NextResponse.json({
      success: true,
      prompt: mapPromptDetail(prompt),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
