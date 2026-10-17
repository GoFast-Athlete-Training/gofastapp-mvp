/**
 * "What does today call for?" — context + optional ingest proposal (athlete confirms).
 */

import type { WorkoutType } from "@prisma/client";
import type { DayBriefResult, PlanIngestPreviewResult } from "@/lib/training/plan-ingest-contract";
import { planScheduleDayForDateKey } from "@/lib/training/plan-schedule";
import {
  isWeekInTaperWindow,
  loadAthletePlanContext,
  weekNumberForPlanDate,
} from "@/lib/training/plan-ingest-plan-context";
import { loadRecentRunLoad } from "@/lib/training/recent-run-load";
import { utcDateOnly, addDaysUtc } from "@/lib/training/plan-utils";

const METERS_PER_MILE = 1609.34;

function yesterdayKey(dateKey: string): string {
  const d = utcDateOnly(new Date(`${dateKey}T12:00:00.000Z`));
  return addDaysUtc(d, -1).toISOString().slice(0, 10);
}

function noteMentionsHeavyLegs(note: string): boolean {
  const n = note.toLowerCase();
  return (
    /\blift(ing|ed)?\b/.test(n) &&
    (/\bleg(s)?\b|\bsquat\b|\bdeadlift\b|\blower\b|\bheavy\b/.test(n) ||
      /\bthursday\b|\bfri\b|\byesterday\b/.test(n))
  );
}

function noteMentionsRain(note: string): boolean {
  return /\brain(ing|y)?\b|\bstorm\b|\bwet\b/i.test(note);
}

function shortenWorkoutType(wt: WorkoutType, miles: number): { workoutType: WorkoutType; miles: number } {
  if (wt === "Intervals") return { workoutType: "Easy", miles: Math.min(miles, 5) };
  if (wt === "Tempo") return { workoutType: "Easy", miles: Math.min(miles, Math.max(4, miles * 0.7)) };
  if (wt === "LongRun") return { workoutType: "Easy", miles: Math.min(miles, Math.max(4, miles * 0.65)) };
  return { workoutType: "Easy", miles: Math.min(miles, Math.max(3, miles * 0.75)) };
}

function buildWorkoutProposal(params: {
  dateKey: string;
  workoutType: WorkoutType;
  miles: number;
  summary: string;
}): PlanIngestPreviewResult {
  return {
    scope: "workout",
    parseSource: "deterministic",
    workout: {
      dateKey: params.dateKey,
      workoutType: params.workoutType,
      miles: Math.round(params.miles * 100) / 100,
      catalogueWorkoutId: null,
    },
    summary: params.summary,
  };
}

async function openAiDayBrief(params: {
  dateKey: string;
  note: string;
  inTaper: boolean;
  scheduledSummary: string | null;
  recentRuns: string;
  ruleHints: string[];
}): Promise<DayBriefResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const systemPrompt = `You advise a runner on TODAY's session. Return JSON only:
{
  "stance": "keep" | "shorten" | "swap" | "rest",
  "reasons": ["string", ...],
  "proposedWorkout": null | { "workoutType": "Easy"|"Tempo"|"Intervals"|"LongRun"|"Race", "miles": number }
}

Rules you MUST follow:
- Heavy lower-body lifting within ~72h: do not upgrade intensity; prefer shorten or easy swap.
- In taper: never upgrade intensity vs scheduled; keep, shorten, or rest only.
- Big yesterday (more miles than planned or hard effort): shorten or easy today.
- Rain alone is not rest — may shorten or swap to treadmill-friendly easy.
- proposedWorkout only when stance is shorten or swap; null for keep/rest unless swap needs explicit miles/type.`;

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
          {
            role: "user",
            content: JSON.stringify({
              dateKey: params.dateKey,
              athleteNote: params.note,
              inTaper: params.inTaper,
              scheduled: params.scheduledSummary,
              recentRuns: params.recentRuns,
              ruleHints: params.ruleHints,
            }),
          },
        ],
        temperature: 0.35,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;

    const stanceRaw = typeof parsed.stance === "string" ? parsed.stance : "keep";
    const stance =
      stanceRaw === "shorten" || stanceRaw === "swap" || stanceRaw === "rest"
        ? stanceRaw
        : "keep";
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === "string")
      : [];

    let proposedIngest: PlanIngestPreviewResult | null = null;
    const pw = parsed.proposedWorkout;
    if (pw && typeof pw === "object" && (stance === "shorten" || stance === "swap")) {
      const o = pw as Record<string, unknown>;
      const wt = typeof o.workoutType === "string" ? o.workoutType : "Easy";
      const miles = typeof o.miles === "number" ? o.miles : Number(o.miles);
      if (Number.isFinite(miles) && miles > 0) {
        proposedIngest = buildWorkoutProposal({
          dateKey: params.dateKey,
          workoutType: wt as WorkoutType,
          miles,
          summary: `Suggested ${wt} ${miles} mi`,
        });
      }
    }

    return { stance, reasons, proposedIngest };
  } catch (e) {
    console.error("plan-day-brief OpenAI:", e);
    return null;
  }
}

function fallbackDayBrief(params: {
  dateKey: string;
  inTaper: boolean;
  scheduledType: WorkoutType | null;
  scheduledMiles: number | null;
  note: string;
  heavyLegs: boolean;
  bigYesterday: boolean;
}): DayBriefResult {
  const reasons: string[] = [];
  let stance: DayBriefResult["stance"] = "keep";
  let proposedIngest: PlanIngestPreviewResult | null = null;

  const miles = params.scheduledMiles ?? 5;
  const wt = params.scheduledType ?? "Easy";

  if (params.heavyLegs) {
    reasons.push("Recent heavy leg work often needs 24–72h before quality or long runs.");
  }
  if (params.bigYesterday) {
    reasons.push("Yesterday looked bigger or harder than a typical easy day.");
  }
  if (params.inTaper) {
    reasons.push("You are in taper — protect freshness for race day.");
  }
  if (noteMentionsRain(params.note)) {
    reasons.push("Weather is rough — easy or shorter often beats forcing the full script.");
  }

  if (params.heavyLegs && (wt === "Tempo" || wt === "Intervals" || wt === "LongRun")) {
    stance = params.inTaper ? "rest" : "swap";
    const alt = shortenWorkoutType(wt, miles);
    proposedIngest = buildWorkoutProposal({
      dateKey: params.dateKey,
      ...alt,
      summary: `Swap to ${alt.workoutType} ${alt.miles} mi after lifting fatigue`,
    });
    reasons.push("Proposed an easy swap instead of today's quality/long.");
  } else if (params.bigYesterday && wt !== "Easy") {
    stance = "shorten";
    const alt = shortenWorkoutType(wt, miles);
    proposedIngest = buildWorkoutProposal({
      dateKey: params.dateKey,
      ...alt,
      summary: `Shorten after a big yesterday`,
    });
  } else if (params.inTaper && wt === "LongRun" && miles > 8) {
    stance = "shorten";
    proposedIngest = buildWorkoutProposal({
      dateKey: params.dateKey,
      workoutType: "Easy",
      miles: Math.min(miles, 8),
      summary: "Taper long run — trim volume",
    });
  }

  if (reasons.length === 0) {
    reasons.push("Schedule looks reasonable for today based on what we know.");
  }

  return { stance, reasons, proposedIngest };
}

export async function buildPlanDayBrief(params: {
  athleteId: string;
  planId: string;
  dateKey: string;
  note?: string;
}): Promise<{ ok: true; brief: DayBriefResult } | { ok: false; error: string }> {
  const dateKey = params.dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "dateKey must be YYYY-MM-DD" };
  }

  const plan = await loadAthletePlanContext(params.planId, params.athleteId);
  if (!plan) return { ok: false, error: "Plan not found" };

  const weekNumber = weekNumberForPlanDate(plan, dateKey);
  const inTaper = isWeekInTaperWindow(plan, weekNumber);

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planSchedule: plan.planSchedule,
    raceDate: plan.raceCtx.raceDate,
    raceName: plan.raceCtx.raceName,
    raceDistanceMiles: plan.raceCtx.raceDistanceMiles,
    dateKey,
    maxWeekNumber: plan.totalWeeks,
  });

  const note = (params.note ?? "").trim();
  const recent = await loadRecentRunLoad({ athleteId: params.athleteId, asOfDateKey: dateKey });

  const yKey = yesterdayKey(dateKey);
  const yRuns = recent.days.filter((d) => d.dateKey === yKey);
  const yMiles = yRuns.reduce((a, d) => a + (d.distanceMiles ?? 0), 0);
  const scheduledMiles = scheduled
    ? scheduled.estimatedDistanceInMeters / METERS_PER_MILE
    : null;
  const bigYesterday =
    yMiles > 0 &&
    (scheduledMiles != null ? yMiles > scheduledMiles * 1.15 : yMiles >= 8);

  const heavyLegs = noteMentionsHeavyLegs(note);

  const scheduledSummary = scheduled
    ? `${scheduled.workoutType} ~${scheduledMiles != null ? Math.round(scheduledMiles * 10) / 10 : "?"} mi`
    : null;

  const recentRunsText = recent.days
    .slice(0, 8)
    .map(
      (d) =>
        `${d.dateKey}: ${d.distanceMiles ?? "?"} mi${d.avgPaceSecPerMile ? ` @ ${Math.round(d.avgPaceSecPerMile / 60)}:${String(Math.round(d.avgPaceSecPerMile % 60)).padStart(2, "0")}/mi` : ""} (${d.source})`
    )
    .join("; ");

  const ruleHints: string[] = [];
  if (heavyLegs) ruleHints.push("heavy_legs");
  if (bigYesterday) ruleHints.push("big_yesterday");
  if (inTaper) ruleHints.push("taper");
  if (noteMentionsRain(note)) ruleHints.push("rain");

  const ai = await openAiDayBrief({
    dateKey,
    note,
    inTaper,
    scheduledSummary,
    recentRuns: recentRunsText || "none",
    ruleHints,
  });

  if (ai) {
    if (inTaper && ai.proposedIngest?.scope === "workout") {
      const schedWt = scheduled?.workoutType;
      const propWt = ai.proposedIngest.workout.workoutType;
      const intensity: Record<string, number> = {
        Easy: 1,
        LongRun: 2,
        Tempo: 3,
        Intervals: 4,
        Race: 5,
      };
      if (schedWt && (intensity[propWt] ?? 0) > (intensity[schedWt] ?? 0)) {
        ai.proposedIngest = null;
        ai.stance = "keep";
        ai.reasons.push("Taper guard: cannot upgrade today's session.");
      }
    }
    return { ok: true, brief: ai };
  }

  return {
    ok: true,
    brief: fallbackDayBrief({
      dateKey,
      inTaper,
      scheduledType: scheduled?.workoutType ?? null,
      scheduledMiles,
      note,
      heavyLegs,
      bigYesterday,
    }),
  };
}
