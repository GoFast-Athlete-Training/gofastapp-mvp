/**
 * Resolves a training gen prompt from gofastapp-mvp's own DB.
 * Uses findFirst — no hardcoded ID. DB is the source of truth.
 *
 * Assembly order:
 *   System: ai_roles.content + prompt_instructions (ordered)
 *   User:   athlete inputs + rule_sets topics/items + return_json_formats schema
 */

import { prisma } from "@/lib/prisma";

export interface TrainingPromptInputs {
  totalWeeks: number;
  raceName: string;
  raceDistanceMiles: number | null;
  raceTypeLabel: string;
  goalTime?: string | null;
  currentWeeklyMileage?: number | null;
  preferredDaysHuman: string;
}

export interface ResolvedPrompt {
  systemMessage: string;
  userMessage: string;
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export async function resolveTrainingPrompt(
  inputs: TrainingPromptInputs
): Promise<ResolvedPrompt | null> {
  const prompt = await prisma.training_gen_prompts.findFirst({
    include: {
      ai_roles: true,
      prompt_instructions: {
        orderBy: { order: "asc" },
      },
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
    },
  });

  if (!prompt) return null;

  const vars: Record<string, string> = {
    totalWeeks: String(inputs.totalWeeks),
    raceName: inputs.raceName,
    raceDistance:
      inputs.raceDistanceMiles != null
        ? String(inputs.raceDistanceMiles)
        : "unknown",
    raceType: inputs.raceTypeLabel,
    goalTime: inputs.goalTime ?? "not specified",
    currentWeeklyMileage:
      inputs.currentWeeklyMileage != null
        ? String(inputs.currentWeeklyMileage)
        : "not specified",
    preferredDays: inputs.preferredDaysHuman,
  };

  // ── System message: AI role + execution instructions ──────────────────────
  const sysParts: string[] = [];

  if (prompt.ai_roles?.content) {
    sysParts.push(prompt.ai_roles.content);
  }

  if (prompt.prompt_instructions.length > 0) {
    sysParts.push("## Instructions");
    for (const inst of prompt.prompt_instructions) {
      if (inst.title) sysParts.push(`### ${inst.title}`);
      if (inst.content) sysParts.push(interpolate(inst.content, vars));
    }
  }

  const systemMessage = sysParts.join("\n\n");

  // ── User message: athlete inputs + rules + return format ──────────────────
  const userParts: string[] = [];

  userParts.push(
    [
      "## Athlete Inputs",
      `- Race: ${inputs.raceName} (${inputs.raceTypeLabel}${inputs.raceDistanceMiles != null ? `, ${inputs.raceDistanceMiles} mi` : ""})`,
      `- Goal Time: ${inputs.goalTime ?? "not specified"}`,
      `- Current Weekly Mileage: ${inputs.currentWeeklyMileage ?? "not specified"} miles/week`,
      `- Total Weeks: ${inputs.totalWeeks}`,
      `- Preferred Training Days: ${inputs.preferredDaysHuman}`,
    ].join("\n")
  );

  if (prompt.rule_sets?.rule_set_topics?.length) {
    userParts.push("## Training Rules");
    for (const topic of prompt.rule_sets.rule_set_topics) {
      userParts.push(`### ${topic.name}`);
      for (const item of topic.rule_set_items) {
        userParts.push(`- ${interpolate(item.text, vars)}`);
      }
    }
  }

  if (prompt.return_json_formats?.schema) {
    const schema = prompt.return_json_formats.schema;
    userParts.push(
      [
        "## Return Format",
        "Return ONLY valid JSON (no markdown) matching this exact shape:",
        typeof schema === "string" ? schema : JSON.stringify(schema, null, 2),
      ].join("\n")
    );
  }

  const userMessage = userParts.join("\n\n");

  return { systemMessage, userMessage };
}
