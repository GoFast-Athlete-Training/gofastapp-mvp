export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const items = await prisma.ai_roles.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/config/ai-roles", e);
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
    const { name, content } = body;
    if (!name || !content) {
      return NextResponse.json(
        { success: false, error: "Name and content are required" },
        { status: 400 }
      );
    }
    const now = new Date();
    const item = await prisma.ai_roles.create({
      data: {
        id: newEntityId(),
        name,
        content,
        updatedAt: now,
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/config/ai-roles", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
