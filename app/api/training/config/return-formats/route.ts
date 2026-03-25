export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const items = await prisma.return_json_formats.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/config/return-formats", e);
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
    const { name, schema, example } = body;
    if (!name || schema === undefined || schema === null) {
      return NextResponse.json(
        { success: false, error: "Name and schema are required" },
        { status: 400 }
      );
    }
    const now = new Date();
    const item = await prisma.return_json_formats.create({
      data: {
        id: newEntityId(),
        name,
        schema: schema as Prisma.InputJsonValue,
        example:
          example != null ? (example as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedAt: now,
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/config/return-formats", e);
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
    await prisma.return_json_formats.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/training/config/return-formats", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
