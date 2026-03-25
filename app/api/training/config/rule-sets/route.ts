export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const items = await prisma.rule_sets.findMany({
      include: {
        rule_set_topics: {
          include: {
            rule_set_items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        topics: item.rule_set_topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          rulesCount: topic.rule_set_items.length,
        })),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/training/config/rule-sets", e);
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
    const { name } = body;
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.rule_sets.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "RuleSet with this name already exists" },
        { status: 409 }
      );
    }

    const now = new Date();
    const item = await prisma.rule_sets.create({
      data: {
        id: newEntityId(),
        name,
        updatedAt: now,
      },
      include: {
        rule_set_topics: {
          include: {
            rule_set_items: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        topics: item.rule_set_topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          rules: topic.rule_set_items.map((rule) => ({
            id: rule.id,
            text: rule.text,
          })),
        })),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/config/rule-sets", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
