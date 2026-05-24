/**
 * User-requested AI coach feedback for logged runs.
 * Requires athlete run context before calling OpenAI.
 */

import { prisma } from "@/lib/prisma";
import type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";
import {
  buildRunResultStatus,
  distanceStatusBadgeText,
  distanceStatus as computeDistanceStatus,
} from "@/lib/training/run-result-status";
import { paceVsTargetBadgeText, paceVsTargetLabel } from "@/lib/training/pace-comparison-display";
import { RUN_CONTEXT_OPTIONS, type RunContextOption } from "@/lib/training/coach-read-display";

export type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";
export { isRunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

export type RunAssessmentContext = {
  contextTags: string[];
  contextNote?: string | null;
};

type AiAssessmentRaw = {
  narrative?: string;
  hrPattern?: string;
  effortQuality?: string;
};

function normalizeHrPattern(
  raw: string | undefined
): RunAnalysisJsonV1["hrPattern"] {
  const u = String(raw || "")
    .toLowerCase()
    .trim();
  if (u === "steady" || u === "drift_up" || u === "drift_down" || u === "variable")
    return u;
  return "unknown";
}

function normalizeEffortQuality(
  raw: string | undefined
): RunAnalysisJsonV1["effortQuality"] {
  const u = String(raw || "")
    .toLowerCase()
    .trim();
  if (u === "on_target" || u === "above" || u === "below") return u;
  return "unknown";
}

function parseAssessmentJson(
  raw: string,
  context: RunAssessmentContext
): RunAnalysisJsonV1 | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: AiAssessmentRaw;
  try {
    parsed = JSON.parse(cleaned) as AiAssessmentRaw;
  } catch {
    return null;
  }
  const narrative = String(parsed.narrative || "").trim().slice(0, 2000);
  if (!narrative) return null;
  return {
    v: 1,
    assessedAt: new Date().toISOString(),
    narrative,
    hrPattern: normalizeHrPattern(parsed.hrPattern),
    effortQuality: normalizeEffortQuality(parsed.effortQuality),
    recommendation: null,
    contextTags: context.contextTags,
    contextNote: context.contextNote?.trim() || null,
  };
}

export function normalizeRunContextTags(tags: unknown): RunContextOption[] {
  if (!Array.isArray(tags)) return [];
  const allowed = new Set<string>(RUN_CONTEXT_OPTIONS);
  return tags
    .map((t) => String(t).trim())
    .filter((t): t is RunContextOption => allowed.has(t));
}

export function hasRunContextInput(context: RunAssessmentContext): boolean {
  const tags = normalizeRunContextTags(context.contextTags);
  const note = context.contextNote?.trim() ?? "";
  return tags.length > 0 || note.length > 0;
}

/**
 * Generate coach feedback after the athlete provides run context.
 * Throws when context is missing or OpenAI fails to produce valid output.
 */
export async function runRunAssessment(params: {
  workoutId: string;
  athleteId: string;
  context: RunAssessmentContext;
}): Promise<RunAnalysisJsonV1> {
  if (!hasRunContextInput(params.context)) {
    throw new Error("Run context required before coach feedback");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Coach feedback unavailable");
  }

  const contextTags = normalizeRunContextTags(params.context.contextTags);
  const contextNote = params.context.contextNote?.trim() || null;
  const context: RunAssessmentContext = { contextTags, contextNote };

  const [workout, athlete] = await Promise.all([
    prisma.workouts.findFirst({
      where: { id: params.workoutId, athleteId: params.athleteId },
      select: {
        id: true,
        title: true,
        workoutType: true,
        matchedActivityId: true,
        estimatedDistanceInMeters: true,
        actualDistanceMeters: true,
        targetPaceSecPerMile: true,
        targetPaceSecPerMileHigh: true,
        paceDeltaSecPerMile: true,
        actualAvgPaceSecPerMile: true,
        actualDurationSeconds: true,
        matched_activity: {
          select: {
            activityName: true,
            activityType: true,
            elevationGain: true,
          },
        },
      },
    }),
    prisma.athlete.findUnique({
      where: { id: params.athleteId },
      select: {
        fiveKPace: true,
        thresholdPace: true,
        aerobicCeilingBpm: true,
      },
    }),
  ]);

  if (!workout?.matchedActivityId || !workout.matched_activity) {
    throw new Error("Workout is not linked to a Garmin activity");
  }
  if (!athlete) {
    throw new Error("Athlete not found");
  }

  const resultStatus = buildRunResultStatus({
    plannedDistanceMeters: workout.estimatedDistanceInMeters,
    actualDistanceMeters: workout.actualDistanceMeters,
    actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
    targetPaceSecPerMile: workout.targetPaceSecPerMile,
    targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
  });

  const distStatus = computeDistanceStatus(
    workout.estimatedDistanceInMeters,
    workout.actualDistanceMeters
  );
  const paceLabel = paceVsTargetLabel(
    workout.actualAvgPaceSecPerMile,
    workout.targetPaceSecPerMile,
    workout.targetPaceSecPerMileHigh
  );

  const payload = {
    workout: {
      title: workout.title,
      workoutType: workout.workoutType,
      plannedDistanceMeters: workout.estimatedDistanceInMeters,
      actualDistanceMeters: workout.actualDistanceMeters,
      targetPaceSecPerMile: workout.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
      actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
      actualDurationSeconds: workout.actualDurationSeconds,
      activityName: workout.matched_activity.activityName,
    },
    deterministicFacts: {
      distanceStatus: distStatus,
      distanceSummary: resultStatus.distanceMessage,
      distanceBadge: distanceStatusBadgeText(distStatus),
      paceStatus: paceLabel,
      paceSummary: resultStatus.paceMessage,
      paceBadge: paceVsTargetBadgeText(paceLabel),
    },
    athleteContext: {
      tags: contextTags,
      note: contextNote,
    },
    athleteBaseline: {
      fiveKPace: athlete.fiveKPace,
      thresholdPace: athlete.thresholdPace,
      aerobicCeilingBpm: athlete.aerobicCeilingBpm,
    },
  };

  const systemPrompt = `You are an encouraging running coach writing a short post-run summary for an athlete.

You receive:
1. Deterministic facts about distance and pace vs plan (already computed — do not contradict them).
2. The athlete's own context about what shaped the run (tags and optional note). Treat this as the primary explanation for why the run looked the way it did.

Write 2-4 short sentences that:
- Acknowledge whether distance was on plan, short, or over.
- Acknowledge whether pace was faster, slower, or in range vs target (when a target exists).
- Weave in the athlete's stated context as the reason — do not invent causes they did not mention.
- Stay supportive and practical. Do not shame. Do not suggest profile or pace updates.

Respond with ONLY a JSON object (no markdown):
{
  "narrative": "2-4 sentences",
  "hrPattern": one of "steady","drift_up","drift_down","variable","unknown",
  "effortQuality": one of "on_target","above","below","unknown"
}`;

  const userPrompt = JSON.stringify(payload, null, 2);

  let content: string;
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("runRunAssessment OpenAI HTTP", res.status, errText.slice(0, 500));
      throw new Error("Coach feedback generation failed");
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof Error && e.message === "Coach feedback generation failed") throw e;
    console.error("runRunAssessment fetch:", e);
    throw new Error("Coach feedback generation failed");
  }

  const analysis = parseAssessmentJson(content, context);
  if (!analysis) {
    throw new Error("Could not parse coach feedback");
  }

  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: {
      analysisJson: analysis as object,
      runContextTags: contextTags,
      runContextNote: contextNote,
      runContextUpdatedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return analysis;
}
