/**
 * Draft publicDescription for /plans/[slug] intro from plan facts + OpenAI sentence structure.
 */

import { prisma } from "@/lib/prisma";
import {
  buildDeterministicPublicPlanDescriptionFallback,
  buildPublicPlanDescriptionFacts,
  type PublicPlanDescriptionFacts,
} from "@/lib/training/draft-public-plan-description-facts";

export type { PublicPlanDescriptionFacts } from "@/lib/training/draft-public-plan-description-facts";
export {
  buildDeterministicPublicPlanDescriptionFallback,
  buildPublicPlanDescriptionFacts,
  summarizePlanScheduleForDescription,
} from "@/lib/training/draft-public-plan-description-facts";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

async function callOpenAiDraft(facts: PublicPlanDescriptionFacts): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const systemPrompt = `You write a short intro blurb for a runner's public training plan page on GoFast.

Output rules:
- Return ONLY plain text — no markdown, no JSON, no bullet lists.
- Exactly 2–4 short sentences.
- First person ("I'm…") or light host voice is fine.
- This appears under the plan title on the public page. Race name, distance, weeks, and goal time already show elsewhere — weave them in naturally but do not repeat metadata as a dry list.
- Mention goal time, tempo and interval workouts, long run rhythm, and progression only when supported by the facts payload.
- Do NOT invent races, finish times, workout types, or schedule details not in the payload.
- Warm, direct tone — what followers should know about this build.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(facts, null, 2) },
        ],
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("draft public plan description OpenAI HTTP", res.status, errText.slice(0, 500));
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = (data.choices?.[0]?.message?.content ?? "").trim();
    return content ? truncate(content.replace(/\*\*/g, ""), 4000) : null;
  } catch (e) {
    console.error("draft public plan description fetch:", e);
    return null;
  }
}

export type DraftPublicPlanDescriptionResult = {
  description: string;
  source: "openai" | "fallback";
};

export async function draftPublicPlanDescriptionForPlan(params: {
  trainingPlanId: string;
  athleteId: string;
}): Promise<DraftPublicPlanDescriptionResult> {
  const plan = await prisma.training_plans.findFirst({
    where: {
      id: params.trainingPlanId,
      athleteId: params.athleteId,
      lifecycleStatus: "ACTIVE",
    },
    select: {
      planSchedule: true,
      totalWeeks: true,
      goalRaceTime: true,
      Athlete: {
        select: { firstName: true },
      },
      race_registry: {
        select: {
          name: true,
          distanceLabel: true,
          distanceMeters: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Active training plan not found");
  }

  const hasSchedule =
    plan.planSchedule != null &&
    Array.isArray(plan.planSchedule) &&
    plan.planSchedule.length > 0;

  if (!hasSchedule) {
    throw new Error("Plan schedule must be generated before drafting a description");
  }

  const raceDistanceLabel =
    plan.race_registry?.distanceLabel ??
    (plan.race_registry?.distanceMeters
      ? `${Math.round(plan.race_registry.distanceMeters / 1609.34)} mi`
      : null);

  const facts = buildPublicPlanDescriptionFacts({
    raceName: plan.race_registry?.name ?? null,
    raceDistanceLabel,
    goalRaceTime: plan.goalRaceTime ?? null,
    totalWeeks: plan.totalWeeks ?? null,
    athleteFirstName: plan.Athlete.firstName ?? null,
    planSchedule: plan.planSchedule,
  });

  const openAiDraft = await callOpenAiDraft(facts);
  if (openAiDraft) {
    return { description: openAiDraft, source: "openai" };
  }

  return {
    description: buildDeterministicPublicPlanDescriptionFallback(facts),
    source: "fallback",
  };
}
