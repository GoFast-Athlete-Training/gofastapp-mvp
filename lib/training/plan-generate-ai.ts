/**
 * One OpenAI call: phases + planWeeks with schedule strings.
 */

export type PlanPhaseOutline = { name: string; startWeek: number; endWeek: number };
export type PlanWeekOutline = {
  weekNumber: number;
  phase: string;
  schedule: string;
};

export type PlanOutlineResult = {
  phases: PlanPhaseOutline[];
  planWeeks: PlanWeekOutline[];
};

const SYSTEM = `You are a running coach. Return ONLY valid JSON (no markdown) with this exact shape:
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
- phases must be exactly four: base, build, peak, taper in order; startWeek/endWeek must cover 1..totalWeeks with no gaps or overlap.
- planWeeks must have exactly totalWeeks entries, weekNumber 1..totalWeeks.
- Each schedule is space-separated tokens: DAY:MILES+TYPE
- DAY is one of: M, Tu, W, Th, F, Sa, Su
- MILES is a number (can be decimal)
- TYPE is one letter: E (easy), T (tempo), I (intervals), L (long run)
- Schedules should match typical marathon (or half) periodization for the given race distance and week count.
- Prefer 4-6 runs per week in base/build, appropriate long run on weekend (Sa or Su).`;

export async function generatePlanOutlineWithOpenAI(params: {
  totalWeeks: number;
  raceName: string;
  raceDistanceMiles: number;
  raceTypeLabel: string;
  goalTime?: string | null;
  currentWeeklyMileage?: number | null;
  preferredDaysHuman: string;
}): Promise<PlanOutlineResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for plan generation");
  }

  const user = [
    `totalWeeks: ${params.totalWeeks}`,
    `race: ${params.raceName} (${params.raceTypeLabel}, ${params.raceDistanceMiles} mi)`,
    `goalTime: ${params.goalTime ?? "not specified"}`,
    `currentWeeklyMileage: ${params.currentWeeklyMileage ?? "not specified"}`,
    `athlete preferred training days: ${params.preferredDaysHuman}`,
    `Generate phases and planWeeks for all ${params.totalWeeks} weeks.`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
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

function validatePlanOutline(parsed: unknown, totalWeeks: number): PlanOutlineResult {
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
    const name = String(x.name ?? "");
    const startWeek = Number(x.startWeek);
    const endWeek = Number(x.endWeek);
    if (!name || !Number.isFinite(startWeek) || !Number.isFinite(endWeek)) {
      throw new Error(`Invalid phase entry at ${i}`);
    }
    return { name, startWeek, endWeek };
  });

  const planWeeks: PlanWeekOutline[] = planWeeksRaw.map((w, i) => {
    if (!w || typeof w !== "object") throw new Error(`Invalid planWeek at ${i}`);
    const x = w as Record<string, unknown>;
    const weekNumber = Number(x.weekNumber);
    const phase = String(x.phase ?? "");
    const schedule = String(x.schedule ?? "").trim();
    if (!Number.isFinite(weekNumber) || !phase || !schedule) {
      throw new Error(`Invalid planWeek entry at ${i}`);
    }
    return { weekNumber, phase, schedule };
  });

  if (planWeeks.length !== totalWeeks) {
    throw new Error(
      `Expected ${totalWeeks} planWeeks, got ${planWeeks.length}`
    );
  }

  const seen = new Set<number>();
  for (const w of planWeeks) {
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

  planWeeks.sort((a, b) => a.weekNumber - b.weekNumber);

  return { phases, planWeeks };
}
