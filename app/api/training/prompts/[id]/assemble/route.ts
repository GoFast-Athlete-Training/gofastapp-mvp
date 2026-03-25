export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

type Ctx = { params: Promise<{ id: string }> };

function assemblePromptFromComponents(components: {
  aiRole: { content: string } | null;
  instructions: Array<{ title: string; content: string }>;
  mustHaves: { fields: unknown } | null;
  ruleSet: {
    topics: Array<{
      name: string;
      rules: Array<{ text: string }>;
    }>;
  } | null;
  returnFormat: { schema: unknown; example: unknown } | null;
}): string {
  const parts: string[] = [];

  if (components.aiRole?.content) {
    parts.push(components.aiRole.content);
  }

  if (components.instructions && components.instructions.length > 0) {
    parts.push("## Instructions");
    components.instructions.forEach((instruction) => {
      if (instruction.title) {
        parts.push(`### ${instruction.title}`);
      }
      if (instruction.content) {
        parts.push(instruction.content);
      }
    });
  }

  if (components.mustHaves?.fields) {
    parts.push("## Required Fields");
    const fields = components.mustHaves.fields;
    if (typeof fields === "string") {
      parts.push(fields);
    } else if (typeof fields === "object") {
      parts.push(JSON.stringify(fields, null, 2));
    }
  }

  if (components.ruleSet?.topics) {
    parts.push("## Training Rules");
    components.ruleSet.topics.forEach((topic) => {
      parts.push(`### ${topic.name}`);
      topic.rules.forEach((rule) => {
        parts.push(`- ${rule.text}`);
      });
    });
  }

  if (components.returnFormat?.schema) {
    parts.push("## Return Format Schema");
    const schema = components.returnFormat.schema;
    if (typeof schema === "string") {
      parts.push(schema);
    } else if (typeof schema === "object") {
      parts.push(JSON.stringify(schema, null, 2));
    }
  }

  if (components.returnFormat?.example) {
    parts.push("## Example Output");
    const example = components.returnFormat.example;
    if (typeof example === "string") {
      parts.push(example);
    } else if (typeof example === "object") {
      parts.push(JSON.stringify(example, null, 2));
    }
  }

  return parts.join("\n\n");
}

function normalizePreferredDays(days: number[]): string {
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return days
    .map((day) => dayNames[day - 1])
    .filter(Boolean)
    .join(", ");
}

function normalizeDate(date: Date | string): string {
  if (typeof date === "string") {
    return date;
  }
  return date.toISOString().split("T")[0];
}

function normalizeUserInputs(userInputs: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};

  Object.keys(userInputs).forEach((key) => {
    const value = userInputs[key];
    if (value !== undefined && value !== null) {
      if (value instanceof Date) {
        normalized[key] = normalizeDate(value);
      } else if (key === "planStartDate" && typeof value === "string") {
        normalized[key] = normalizeDate(value);
      } else if (key === "preferredDays" && Array.isArray(value)) {
        normalized[key] = normalizePreferredDays(value as number[]);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "number") {
          normalized[key] = normalizePreferredDays(value as number[]);
        } else {
          normalized[key] = JSON.stringify(value);
        }
      } else {
        normalized[key] = String(value);
      }
    }
  });

  return normalized;
}

export async function POST(request: NextRequest, context: Ctx) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const { id: promptId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { userInputs } = body as { userInputs?: Record<string, unknown> };

    const prompt = await prisma.training_gen_prompts.findUnique({
      where: { id: promptId },
      include: {
        ai_roles: true,
        rule_sets: {
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
        },
        must_haves: true,
        return_json_formats: true,
        prompt_instructions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt not found" },
        { status: 404 }
      );
    }

    const mappedRuleSet = prompt.rule_sets
      ? {
          topics: prompt.rule_sets.rule_set_topics.map((topic) => ({
            name: topic.name,
            rules: topic.rule_set_items.map((rule) => ({ text: rule.text })),
          })),
        }
      : null;

    let assembledText = assemblePromptFromComponents({
      aiRole: prompt.ai_roles,
      instructions: prompt.prompt_instructions,
      mustHaves: prompt.must_haves,
      ruleSet: mappedRuleSet,
      returnFormat: prompt.return_json_formats,
    });

    let normalizedInputs: Record<string, string> | undefined;
    if (userInputs) {
      normalizedInputs = normalizeUserInputs(userInputs);
      Object.keys(normalizedInputs).forEach((key) => {
        const placeholder = `{${key}}`;
        const value = normalizedInputs![key];
        assembledText = assembledText.replace(
          new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
          value
        );
      });
      if (!assembledText.toLowerCase().includes("json")) {
        assembledText += "\n\nPlease return your response as valid JSON.";
      }
    }

    return NextResponse.json({
      success: true,
      prompt: {
        id: prompt.id,
        name: prompt.name,
        assembledText,
        ...(normalizedInputs && { userInputs: normalizedInputs }),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/prompts/[id]/assemble", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
