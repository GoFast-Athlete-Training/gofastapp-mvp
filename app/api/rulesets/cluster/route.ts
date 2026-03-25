export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";
import { clusterRuleSet } from "@/lib/training/cluster-rule-set";
import { newEntityId } from "@/lib/training/new-entity-id";

export async function POST(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { name, blob, rulesetId } = body;

    if (!name || !blob) {
      return NextResponse.json(
        { success: false, error: "Name and blob are required" },
        { status: 400 }
      );
    }

    const clustered = await clusterRuleSet(blob);

    let ruleset: { id: string; name: string };

    if (rulesetId) {
      const found = await prisma.rule_sets.findUnique({
        where: { id: rulesetId },
      });
      if (!found) {
        return NextResponse.json(
          { success: false, error: "Rule set not found" },
          { status: 404 }
        );
      }
      if (found.name !== name) {
        const nameExists = await prisma.rule_sets.findFirst({
          where: { name, id: { not: rulesetId } },
        });
        if (nameExists) {
          return NextResponse.json(
            { success: false, error: "A rule set with this name already exists" },
            { status: 409 }
          );
        }
        ruleset = await prisma.rule_sets.update({
          where: { id: rulesetId },
          data: { name, updatedAt: new Date() },
        });
      } else {
        ruleset = found;
      }

      const existingTopics = await prisma.rule_set_topics.findMany({
        where: { rulesetId: ruleset.id },
        select: { id: true },
      });
      const topicIds = existingTopics.map((t) => t.id);
      if (topicIds.length > 0) {
        await prisma.rule_set_items.deleteMany({
          where: { topicId: { in: topicIds } },
        });
      }
      await prisma.rule_set_topics.deleteMany({
        where: { rulesetId: ruleset.id },
      });
    } else {
      let found = await prisma.rule_sets.findFirst({
        where: { name },
      });

      if (found) {
        const existingTopics = await prisma.rule_set_topics.findMany({
          where: { rulesetId: found.id },
          select: { id: true },
        });
        const topicIds = existingTopics.map((t) => t.id);
        if (topicIds.length > 0) {
          await prisma.rule_set_items.deleteMany({
            where: { topicId: { in: topicIds } },
          });
        }
        await prisma.rule_set_topics.deleteMany({
          where: { rulesetId: found.id },
        });
        ruleset = found;
      } else {
        const now = new Date();
        ruleset = await prisma.rule_sets.create({
          data: {
            id: newEntityId(),
            name,
            updatedAt: now,
          },
        });
      }
    }

    const topicsWithRules: Array<{
      topicId: string;
      topic: string;
      rules: Array<{ id: string; text: string }>;
    }> = [];

    const now = new Date();
    for (const topicData of clustered.topics) {
      const topic = await prisma.rule_set_topics.create({
        data: {
          id: newEntityId(),
          rulesetId: ruleset.id,
          name: topicData.topic,
          updatedAt: now,
        },
      });

      const rules: Array<{ id: string; text: string }> = [];
      for (const ruleText of topicData.rules) {
        const item = await prisma.rule_set_items.create({
          data: {
            id: newEntityId(),
            topicId: topic.id,
            text: ruleText,
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

    return NextResponse.json({
      success: true,
      rulesetId: ruleset.id,
      name: ruleset.name,
      topics: topicsWithRules,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/rulesets/cluster", e);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cluster rule set",
        details: msg,
      },
      { status: 500 }
    );
  }
}
