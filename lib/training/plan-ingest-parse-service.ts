/**
 * Preview plan ingest — deterministic parse first, OpenAI fallback for week/plan.
 */

import type { WorkoutType } from "@prisma/client";
import type {
  PlanIngestPreviewResult,
  PlanIngestScope,
} from "@/lib/training/plan-ingest-contract";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  tryParsePastedFullPlanText,
  tryParsePastedWeekScheduleText,
} from "@/lib/training/parse-pasted-plan-week";
import {
  parsedPasteToAiGenerateResponse,
  tryParsePastedWorkoutText,
} from "@/lib/training/parse-pasted-workout";
import {
  loadAthletePlanContext,
  weekNumberForPlanDate,
} from "@/lib/training/plan-ingest-plan-context";
import {
  appendSkippedToSummary,
  applyWeekIngestGuard,
} from "@/lib/training/plan-week-ingest-guard";
import { buildWeekPreviewDays } from "@/lib/training/plan-week-preview-days";
import type { PlanWeekIngestRow } from "@/lib/training/plan-ingest-contract";
import {
  looksLikePlanWeekCsv,
  tryParsePlanWeekCsvText,
} from "@/lib/training/parse-plan-week-csv";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";
import { utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";
import type { WorkoutStep } from "@/lib/training/prescription";

const WORKOUT_TYPES = new Set<string>(["Easy", "Tempo", "Intervals", "LongRun", "Race"]);

function refreshWeekIngestRowsAfterGuard(
  rows: PlanWeekIngestRow[] | undefined,
  protectedDateKeys: Set<string>
): PlanWeekIngestRow[] | undefined {
  if (!rows?.length) return rows;
  return rows.map((row) => {
    if (row.status !== "import") return row;
    if (protectedDateKeys.has(row.dateKey)) {
      return {
        ...row,
        status: "skipped_protected" as const,
        detail: "Protected (race or already completed)",
      };
    }
    return row;
  });
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeDay(raw: unknown): PlanDaySchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dow = typeof o.dow === "number" ? o.dow : Number(o.dow);
  const wtRaw = typeof o.workoutType === "string" ? o.workoutType.trim() : "";
  const workoutType = WORKOUT_TYPES.has(wtRaw) ? (wtRaw as WorkoutType) : "Easy";
  const miles = typeof o.miles === "number" ? o.miles : Number(o.miles);
  if (!Number.isFinite(dow) || dow < 1 || dow > 7) return null;
  if (!Number.isFinite(miles) || miles <= 0) return null;
  return {
    dow: Math.floor(dow),
    workoutType,
    miles: Math.round(miles * 100) / 100,
    catalogueWorkoutId:
      typeof o.catalogueWorkoutId === "string" ? o.catalogueWorkoutId.trim() || null : null,
    planCycleIndex:
      typeof o.planCycleIndex === "number" && Number.isFinite(o.planCycleIndex)
        ? Math.floor(o.planCycleIndex)
        : null,
  };
}

function normalizeWeek(raw: unknown, weekNumber: number): PlanWeekSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const wn =
    typeof o.weekNumber === "number" && Number.isFinite(o.weekNumber)
      ? Math.floor(o.weekNumber)
      : weekNumber;
  const daysRaw = Array.isArray(o.days) ? o.days : [];
  const days: PlanDaySchedule[] = [];
  for (const d of daysRaw) {
    const day = normalizeDay(d);
    if (day) days.push(day);
  }
  if (days.length === 0) return null;
  days.sort((a, b) => a.dow - b.dow);
  return { weekNumber: wn, days };
}

async function openAiParseWeekOrPlan(params: {
  scope: "week" | "plan";
  sourceText: string;
  weekNumber?: number;
}): Promise<{ weeks: PlanWeekSchedule[]; summary: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const systemPrompt =
    params.scope === "week"
      ? `Parse one training week from athlete paste. Return JSON only:
{ "summary": "short human summary", "week": { "weekNumber": number, "days": [{ "dow": 1-7 (Mon=1), "workoutType": "Easy"|"Tempo"|"Intervals"|"LongRun"|"Race", "miles": number }] } }
Omit rest days. Do not invent catalogue IDs.`
      : `Parse a multi-week training plan from athlete paste. Return JSON only:
{ "summary": "short human summary", "weeks": [{ "weekNumber": number, "days": [{ "dow": 1-7, "workoutType": "Easy"|"Tempo"|"Intervals"|"LongRun"|"Race", "miles": number }] }] }
Omit rest days. Week numbers must be positive integers.`;

  const userContent =
    params.scope === "week"
      ? JSON.stringify({ weekNumber: params.weekNumber ?? 1, sourceText: params.sourceText })
      : JSON.stringify({ sourceText: params.sourceText });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as Record<string, unknown> | null;
    if (!parsed) return null;
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "Parsed schedule";

    if (params.scope === "week") {
      const week = normalizeWeek(parsed.week, params.weekNumber ?? 1);
      if (!week) return null;
      return { weeks: [week], summary };
    }

    const weeksRaw = Array.isArray(parsed.weeks) ? parsed.weeks : [];
    const weeks: PlanWeekSchedule[] = [];
    for (const w of weeksRaw) {
      const wn =
        w && typeof w === "object" && typeof (w as Record<string, unknown>).weekNumber === "number"
          ? Math.floor((w as Record<string, unknown>).weekNumber as number)
          : weeks.length + 1;
      const week = normalizeWeek(w, wn);
      if (week) weeks.push(week);
    }
    if (weeks.length === 0) return null;
    weeks.sort((a, b) => a.weekNumber - b.weekNumber);
    return { weeks, summary };
  } catch (e) {
    console.error("plan-ingest OpenAI:", e);
    return null;
  }
}

export async function previewPlanIngest(params: {
  athleteId: string;
  planId: string;
  scope: PlanIngestScope;
  sourceText: string;
  dateKey?: string;
  weekNumber?: number;
}): Promise<{ ok: true; preview: PlanIngestPreviewResult } | { ok: false; error: string }> {
  const text = params.sourceText.trim();
  if (!text) return { ok: false, error: "sourceText is required" };

  const plan = await loadAthletePlanContext(params.planId, params.athleteId);
  if (!plan) return { ok: false, error: "Plan not found" };

  if (params.scope === "workout") {
    const dateKey = params.dateKey?.trim();
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return { ok: false, error: "dateKey (YYYY-MM-DD) is required for workout scope" };
    }

    const parsed = tryParsePastedWorkoutText(text);
    let parseSource: "deterministic" | "openai" = "deterministic";
    let segments = parsed
      ? parsedPasteToAiGenerateResponse(parsed, plan.currentFiveKPace).segments
      : [];

    let workoutType: WorkoutType = "Easy";
    let miles = 0;
    if (parsed) {
      const totalMi = parsed.segments.reduce((acc, s) => {
        if (s.durationType === "DISTANCE") return acc + s.durationValue;
        return acc;
      }, 0);
      miles = totalMi > 0 ? Math.round(totalMi * 100) / 100 : 5;
      const lower = text.toLowerCase();
      if (/\btempo\b|\bthreshold\b/.test(lower)) workoutType = "Tempo";
      else if (/\binterval|\bspeed\b/.test(lower)) workoutType = "Intervals";
      else if (/\blong\b/.test(lower)) workoutType = "LongRun";
      else if (/\brace\b/.test(lower)) workoutType = "Race";
    } else {
      parseSource = "openai";
      const ai = await openAiParseWeekOrPlan({ scope: "week", sourceText: text, weekNumber: 1 });
      const day = ai?.weeks[0]?.days[0];
      if (!day) {
        return { ok: false, error: "Could not parse workout — try clearer miles and workout type" };
      }
      workoutType = day.workoutType;
      miles = day.miles;
      segments = [];
    }

    return {
      ok: true,
      preview: {
        scope: "workout",
        parseSource,
        workout: {
          dateKey,
          workoutType,
          miles,
          catalogueWorkoutId: null,
          segments: segments.length > 0 ? segments : undefined,
          suggestedTitle: parsed?.suggestedTitle,
          suggestedDescription: parsed?.suggestedDescription,
        },
        summary: parsed?.suggestedTitle ?? `${workoutType} · ${miles} mi on ${dateKey}`,
      },
    };
  }

  if (params.scope === "week") {
    const weekNumber =
      params.weekNumber ??
      (params.dateKey ? weekNumberForPlanDate(plan, params.dateKey) : 1);

    const bounds = weekBoundsFromPlan(plan.startDate, weekNumber, {
      raceDate: plan.raceCtx.raceDate,
      totalWeeks: plan.totalWeeks,
    });
    const raceDateKey = plan.raceCtx.raceDate
      ? ymdFromDate(utcDateOnly(plan.raceCtx.raceDate))
      : null;

    let parseSource: "deterministic" | "openai" = "deterministic";
    let incomingWeek: PlanWeekSchedule | null = null;
    let daySegmentsByDateKey: Record<string, WorkoutStep[]> | undefined;
    let metaByDateKey: Record<string, { workoutName?: string; paceNote?: string }> | undefined;
    let weekIngestRows: PlanWeekIngestRow[] | undefined;
    const preGuardNotes: string[] = [];

    if (looksLikePlanWeekCsv(text)) {
      const csv = tryParsePlanWeekCsvText({
        sourceText: text,
        weekNumber,
        weekBounds: bounds,
        fiveKPace: plan.currentFiveKPace,
        raceDateKey,
      });
      if (!csv) {
        return {
          ok: false,
          error: "Could not parse CSV — need Date, Workout, Type, Mileage, Pace columns",
        };
      }
      incomingWeek = csv.week;
      daySegmentsByDateKey =
        Object.keys(csv.daySegmentsByDateKey).length > 0
          ? csv.daySegmentsByDateKey
          : undefined;
      metaByDateKey =
        Object.keys(csv.metaByDateKey).length > 0 ? csv.metaByDateKey : undefined;
      weekIngestRows = csv.weekIngestRows;
      preGuardNotes.push(...csv.skippedNotes, ...csv.outOfWeekNotes);
    } else {
      const deterministic = tryParsePastedWeekScheduleText(text, weekNumber);
      if (deterministic) {
        incomingWeek = deterministic;
      } else {
        parseSource = "openai";
        const ai = await openAiParseWeekOrPlan({ scope: "week", sourceText: text, weekNumber });
        const week = ai?.weeks[0];
        if (!week) {
          return {
            ok: false,
            error: "Could not parse this week — use lines like Mon easy 5, Wed tempo 6, or upload CSV",
          };
        }
        week.weekNumber = weekNumber;
        incomingWeek = week;
      }
    }

    if (!incomingWeek) {
      return { ok: false, error: "Could not parse this week" };
    }

    const { week: guardedWeek, skippedNotes, protectedDateKeys } = await applyWeekIngestGuard({
      plan,
      weekNumber,
      incomingWeek,
    });

    weekIngestRows = refreshWeekIngestRowsAfterGuard(weekIngestRows, protectedDateKeys);

    const weekPreviewDays = buildWeekPreviewDays({
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
      guardedWeek,
      protectedDateKeys,
      raceDateKey,
      metaByDateKey,
      daySegmentsByDateKey,
    });

    const totalMi = guardedWeek.days.reduce((a, d) => a + d.miles, 0);
    let summary = `Week ${weekNumber}: ${guardedWeek.days.length} days, ~${Math.round(totalMi)} mi`;
    summary = appendSkippedToSummary(summary, [...preGuardNotes, ...skippedNotes]);

    return {
      ok: true,
      preview: {
        scope: "week",
        parseSource,
        week: { weekNumber, week: guardedWeek },
        summary,
        daySegmentsByDateKey,
        weekPreviewDays,
        weekIngestRows,
      },
    };
  }

  /** plan scope */
  const deterministicWeeks = tryParsePastedFullPlanText(text);
  if (deterministicWeeks && deterministicWeeks.length > 0) {
    return {
      ok: true,
      preview: {
        scope: "plan",
        parseSource: "deterministic",
        plan: { weeks: deterministicWeeks },
        summary: `${deterministicWeeks.length} week(s) parsed`,
      },
    };
  }

  const ai = await openAiParseWeekOrPlan({ scope: "plan", sourceText: text });
  if (!ai || ai.weeks.length === 0) {
    return {
      ok: false,
      error: "Could not parse plan — use Week 1 / Week 2 headers or day lines",
    };
  }
  return {
    ok: true,
    preview: {
      scope: "plan",
      parseSource: "openai",
      plan: { weeks: ai.weeks },
      summary: ai.summary,
    },
  };
}
