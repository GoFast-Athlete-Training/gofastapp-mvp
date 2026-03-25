/**
 * One OpenAI call: phases + planWeeks with schedule strings.
 * Attempts to resolve prompt from gofastapp-mvp's own DB first (training_gen_prompts).
 * Falls back to hardcoded system prompt if no DB prompt is found.
 */

import type { PlanPhaseOutline, PlanWeekOutline } from "./plan-generate-ai-types";

export type { PlanPhaseOutline, PlanWeekOutline, PlanOutlineResult } from "./plan-generate-ai-types";

import {
  validatePhasesCoverWeeks,
  applyWeekPhasesFromPhases,
} from "./plan-outline-validate";

import { resolveTrainingPrompt } from "./prompt-resolver";

const SHORT_PLAN_MAX_WEEKS = 8;

const SYSTEM_LONG = `You are a running coach. Return ONLY valid JSON (no markdown) with this exact shape:
{
  "phases": [
    { "name": "base", "startWeek": 1, "endWeek": 6 },
    { "name": "build", "startWeek": 7, "endWeek": 13 },
    { "name": "peak", "startWeek": 14, "endWeek": 18 },
    { "name": "taper", "startWeek": 19, "endWeek": 20 }
  ],
  "planWeeks": [
    { "weekNumber": 1, "phase": "base", "schedule": "M:5E W:5E Th:5E Sa:5E Su:10L" }
  ]
}

Rules:
- phases: use exactly four segments in order: base, build, peak, taper (lowercase names). startWeek/endWeek must partition 1..totalWeeks with no gaps or overlap.
- planWeeks must have exactly totalWeeks entries, weekNumber 1..totalWeeks.
- Each schedule is space-separated tokens: DAY:MILES+TYPE
- DAY is one of: M, Tu, W, Th, F, Sa, Su
- MILES is a number (can be decimal)
- TYPE is one letter: E (easy), T (tempo), I (intervals), L (long run)
- Schedules should match typical marathon (or half) periodization for the given race distance and week count.
- Prefer 4-6 runs per week in base/build, appropriate long run on weekend (Sa or Su).`;

const SYSTEM_SHORT = (totalWeeks: number) => `You are a running coach. Return ONLY valid JSON (no markdown).

totalWeeks for this athlete is ${totalWeeks} (short runway — e.g. final weeks before race).

Return shape:
{
  "phases": [
    { "name": "Sharpening", "startWeek": 1, "endWeek": 2 },
    { "name": "Taper", "startWeek": 3, "endWeek": 4 }
  ],
  "planWeeks": [
    { "weekNumber": 1, "phase": "Sharpening", "schedule": "M:5E Tu:5E Th:5E Sa:10L" }
  ]
}

Rules:
- phases: use 1 to 4 segments with DISTINCT, human-readable names (e.g. Maintenance, Sharpening, Race-specific prep, Taper, Race week). Lowercase in JSON is fine; names must NOT all be the same.
- startWeek/endWeek must partition weeks 1 through ${totalWeeks} exactly once each — no gaps, no overlaps, every week 1..${totalWeeks} appears in exactly one phase.
- planWeeks: exactly ${totalWeeks} entries, weekNumber 1..${totalWeeks}.
- Each schedule: space-separated DAY:MILES+TYPE tokens; DAY ∈ M, Tu, W, Th, F, Sa, Su; TYPE ∈ E, T, I, L.
- Schedules must respect athlete preferred days and stay appropriate for the race distance and remaining weeks.`;

export async function generatePlanOutlineWithOpenAI(params: {
  totalWeeks: number;
  raceName: string;
  raceDistanceMiles: number;
  raceTypeLabel: string;
  goalTime?: string | null;
  currentWeeklyMileage?: number | null;
  preferredDaysHuman: string;
}): Promise<import("./plan-generate-ai-types").PlanOutlineResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for plan generation");
  }

  // Try DB-driven prompt first; fall back to hardcoded if none found
  const resolved = await resolveTrainingPrompt({
    totalWeeks: params.totalWeeks,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
    raceTypeLabel: params.raceTypeLabel,
    goalTime: params.goalTime,
    currentWeeklyMileage: params.currentWeeklyMileage,
    preferredDaysHuman: params.preferredDaysHuman,
  });

  let system: string;
  let user: string;

  if (resolved) {
    console.log("[plan-generate-ai] Using DB-resolved prompt from training_gen_prompts");
    system = resolved.systemMessage;
    user = resolved.userMessage;
  } else {
    console.log("[plan-generate-ai] No DB prompt found — falling back to hardcoded prompt");
    system =
      params.totalWeeks <= SHORT_PLAN_MAX_WEEKS
        ? SYSTEM_SHORT(params.totalWeeks)
        : SYSTEM_LONG;
    user = [
      `totalWeeks: ${params.totalWeeks}`,
      `race: ${params.raceName} (${params.raceTypeLabel}, ${params.raceDistanceMiles} mi)`,
      `goalTime: ${params.goalTime ?? "not specified"}`,
      `currentWeeklyMileage: ${params.currentWeeklyMileage ?? "not specified"}`,
      `athlete preferred training days: ${params.preferredDaysHuman}`,
      `Generate phases and planWeeks for all ${params.totalWeeks} weeks.`,
    ].join("\n");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI plan generation failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty OpenAI response");
  }

  const parsed = JSON.parse(content) as unknown;
  return validatePlanOutline(parsed, params.totalWeeks);
}

function validatePlanOutline(
  parsed: unknown,
  totalWeeks: number
): import("./plan-generate-ai-types").PlanOutlineResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON: not an object");
  }
  const o = parsed as Record<string, unknown>;
  const phasesRaw = o.phases;
  const planWeeksRaw = o.planWeeks;
  if (!Array.isArray(phasesRaw) || !Array.isArray(planWeeksRaw)) {
    throw new Error("Invalid JSON: phases and planWeeks must be arrays");
  }

  const phases: PlanPhaseOutline[] = phasesRaw.map((p, i) => {
    if (!p || typeof p !== "object") throw new Error(`Invalid phase at ${i}`);
    const x = p as Record<string, unknown>;
    const name = String(x.name ?? "").trim();
    const startWeek = Number(x.startWeek);
    const endWeek = Number(x.endWeek);
    if (!name || !Number.isFinite(startWeek) || !Number.isFinite(endWeek)) {
      throw new Error(`Invalid phase entry at ${i}`);
    }
    return { name, startWeek, endWeek };
  });

  const planWeeksDraft: PlanWeekOutline[] = planWeeksRaw.map((w, i) => {
    if (!w || typeof w !== "object") throw new Error(`Invalid planWeek at ${i}`);
    const x = w as Record<string, unknown>;
    const weekNumber = Number(x.weekNumber);
    const phase = String(x.phase ?? "").trim();
    const schedule = String(x.schedule ?? "").trim();
    if (!Number.isFinite(weekNumber) || !schedule) {
      throw new Error(`Invalid planWeek entry at ${i}`);
    }
    return { weekNumber, phase: phase || "training", schedule };
  });

  if (planWeeksDraft.length !== totalWeeks) {
    throw new Error(
      `Expected ${totalWeeks} planWeeks, got ${planWeeksDraft.length}`
    );
  }

  const seen = new Set<number>();
  for (const w of planWeeksDraft) {
    if (w.weekNumber < 1 || w.weekNumber > totalWeeks) {
      throw new Error(`Invalid weekNumber ${w.weekNumber}`);
    }
    if (seen.has(w.weekNumber)) {
      throw new Error(`Duplicate weekNumber ${w.weekNumber}`);
    }
    seen.add(w.weekNumber);
  }
  if (seen.size !== totalWeeks) {
    throw new Error("Missing some week numbers");
  }

  planWeeksDraft.sort((a, b) => a.weekNumber - b.weekNumber);

  const normalizedPhases = validatePhasesCoverWeeks(phases, totalWeeks);
  const planWeeks = applyWeekPhasesFromPhases(normalizedPhases, planWeeksDraft);

  return { phases: normalizedPhases, planWeeks };
}
