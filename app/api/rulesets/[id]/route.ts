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
    const { id: ruleSetId } = await context.params;
    const ruleSet = await prisma.rule_sets.findUnique({
      where: { id: ruleSetId },
      include: {
        rule_set_topics: {
          include: {
            rule_set_items: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ruleSet) {
      return NextResponse.json(
        { success: false, error: "Rule set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: ruleSet.id,
      name: ruleSet.name,
      topics: ruleSet.rule_set_topics.map((topic) => ({
        topicId: topic.id,
        topic: topic.name,
        rules: topic.rule_set_items.map((rule) => ({
          id: rule.id,
          text: rule.text,
        })),
      })),
      createdAt: ruleSet.createdAt,
      updatedAt: ruleSet.updatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/rulesets/[id]", e);
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
    const { id: ruleSetId } = await context.params;
    const body = await request.json();
    const { name, topics } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    if (!topics || !Array.isArray(topics)) {
      return NextResponse.json(
        { success: false, error: "Topics array is required" },
        { status: 400 }
      );
    }

    for (const topic of topics) {
      if (!topic.topic || typeof topic.topic !== "string" || !topic.topic.trim()) {
        return NextResponse.json(
          { success: false, error: "All topics must have a name" },
          { status: 400 }
        );
      }
      if (!topic.rules || !Array.isArray(topic.rules)) {
        return NextResponse.json(
          { success: false, error: "All topics must have a rules array" },
          { status: 400 }
        );
      }
      for (const rule of topic.rules) {
        if (!rule.text || typeof rule.text !== "string" || !rule.text.trim()) {
          return NextResponse.json(
            { success: false, error: "All rules must have text" },
            { status: 400 }
          );
        }
      }
    }

    const existingRuleSet = await prisma.rule_sets.findUnique({
      where: { id: ruleSetId },
    });

    if (!existingRuleSet) {
      return NextResponse.json(
        { success: false, error: "Rule set not found" },
        { status: 404 }
      );
    }

    if (name.trim() !== existingRuleSet.name) {
      const nameExists = await prisma.rule_sets.findFirst({
        where: { name: name.trim(), id: { not: ruleSetId } },
      });
      if (nameExists) {
        return NextResponse.json(
          { success: false, error: "A rule set with this name already exists" },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedRuleSet = await tx.rule_sets.update({
        where: { id: ruleSetId },
        data: { name: name.trim(), updatedAt: new Date() },
      });

      const existingTopics = await tx.rule_set_topics.findMany({
        where: { rulesetId: ruleSetId },
        select: { id: true },
      });
      const topicIds = existingTopics.map((t) => t.id);

      if (topicIds.length > 0) {
        await tx.rule_set_items.deleteMany({
          where: { topicId: { in: topicIds } },
        });
      }
      await tx.rule_set_topics.deleteMany({
        where: { rulesetId: ruleSetId },
      });

      const topicsWithRules: Array<{
        topicId: string;
        topic: string;
        rules: Array<{ id: string; text: string }>;
      }> = [];

      const now = new Date();
      for (const topicData of topics) {
        const topic = await tx.rule_set_topics.create({
          data: {
            id: newEntityId(),
            rulesetId: ruleSetId,
            name: topicData.topic.trim(),
            updatedAt: now,
          },
        });

        const rules: Array<{ id: string; text: string }> = [];
        for (const ruleData of topicData.rules) {
          const item = await tx.rule_set_items.create({
            data: {
              id: newEntityId(),
              topicId: topic.id,
              text: ruleData.text.trim(),
              updatedAt: now,
            },
          });
          rules.push({ id: item.id, text: item.text });
        }

        topicsWithRules.push({
          topicId: topic.id,
          topic: topic.name,
          rules,
        });
      }

      return {
        rulesetId: updatedRuleSet.id,
        name: updatedRuleSet.name,
        updatedAt: updatedRuleSet.updatedAt,
        topics: topicsWithRules,
      };
    });

    return NextResponse.json({
      success: true,
      rulesetId: result.rulesetId,
      name: result.name,
      updatedAt: result.updatedAt,
      topics: result.topics,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PUT /api/rulesets/[id]", e);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update rule set",
        details: msg,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id: ruleSetId } = await context.params;

    const existingRuleSet = await prisma.rule_sets.findUnique({
      where: { id: ruleSetId },
    });

    if (!existingRuleSet) {
      return NextResponse.json(
        { success: false, error: "Rule set not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const existingTopics = await tx.rule_set_topics.findMany({
        where: { rulesetId: ruleSetId },
        select: { id: true },
      });
      const topicIds = existingTopics.map((t) => t.id);
      if (topicIds.length > 0) {
        await tx.rule_set_items.deleteMany({
          where: { topicId: { in: topicIds } },
        });
      }
      await tx.rule_set_topics.deleteMany({
        where: { rulesetId: ruleSetId },
      });
      await tx.rule_sets.delete({
        where: { id: ruleSetId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Rule set deleted successfully",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/rulesets/[id]", e);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete rule set",
        details: msg,
      },
      { status: 500 }
    );
  }
}
