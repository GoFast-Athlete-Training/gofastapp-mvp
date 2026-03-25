export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, schema, example } = body;
    if (!name || schema === undefined || schema === null) {
      return NextResponse.json(
        { success: false, error: "Name and schema are required" },
        { status: 400 }
      );
    }
    const item = await prisma.return_json_formats.update({
      where: { id },
      data: {
        name,
        schema: schema as Prisma.InputJsonValue,
        example:
          example != null ? (example as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PUT /api/training/config/return-formats/[id]", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
