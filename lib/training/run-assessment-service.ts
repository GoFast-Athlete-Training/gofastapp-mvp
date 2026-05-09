/**
 * Post-sync AI assessment for any logged run (plan or standalone).
 * Writes structured copy to workouts.analysisJson for AnalysisDeepPanel.
 */

import { prisma } from "@/lib/prisma";
import type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

export type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";
export { isRunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

type AiAssessmentRaw = {
  narrative?: string;
  hrPattern?: string;
  effortQuality?: string;
  recommendation?: {
    field?: string | null;
    suggestedValue?: number | null;
    reason?: string;
  } | null;
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

function normalizeRecommendation(
  rec: AiAssessmentRaw["recommendation"]
): RunAnalysisJsonV1["recommendation"] {
  if (!rec || rec.field == null || rec.suggestedValue == null) return null;
  const field = String(rec.field).trim();
  const sv = Number(rec.suggestedValue);
  if (!Number.isFinite(sv) || sv <= 0) return null;
  if (field === "aerobicCeilingBpm") {
    const bpm = Math.round(sv);
    if (bpm < 80 || bpm > 210) return null;
    return {
      field: "aerobicCeilingBpm",
      suggestedValue: bpm,
      reason: String(rec.reason || "").slice(0, 500),
    };
  }
  if (field === "fiveKPaceSecPerMile") {
    const sec = Math.round(sv);
    if (sec < 240 || sec > 840) return null;
    return {
      field: "fiveKPaceSecPerMile",
      suggestedValue: sec,
      reason: String(rec.reason || "").slice(0, 500),
    };
  }
  return null;
}

function parseAssessmentJson(raw: string): RunAnalysisJsonV1 | null {
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
    recommendation: normalizeRecommendation(parsed.recommendation),
  };
}

/**
 * Fire after Garmin match or promote. Safe to call from waitUntil; errors are logged only.
 */
export async function runRunAssessment(params: {
  workoutId: string;
  athleteId: string;
}): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("runRunAssessment: OPENAI_API_KEY missing, skipping");
    return;
  }

  const [workout, athlete] = await Promise.all([
    prisma.workouts.findFirst({
      where: { id: params.workoutId, athleteId: params.athleteId },
      select: {
        id: true,
        title: true,
        workoutType: true,
        planId: true,
        weekNumber: true,
        paceDeltaSecPerMile: true,
        targetPaceSecPerMile: true,
        targetPaceSecPerMileHigh: true,
        hrDeltaBpm: true,
        actualAvgPaceSecPerMile: true,
        actualAverageHeartRate: true,
        actualMaxHeartRate: true,
        actualDurationSeconds: true,
        actualDistanceMeters: true,
        matched_activity: {
          select: { activityName: true, activityType: true },
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

  if (!workout?.matched_activity) {
    return;
  }
  if (!athlete) {
    return;
  }

  const hasPlanTargets =
    workout.targetPaceSecPerMile != null || workout.hrDeltaBpm != null;

  const payload = {
    workout: {
      title: workout.title,
      workoutType: workout.workoutType,
      hasPlanTargets,
      targetPaceSecPerMile: workout.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
      paceDeltaSecPerMile: workout.paceDeltaSecPerMile,
      hrDeltaBpm: workout.hrDeltaBpm,
      actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
      actualAverageHeartRate: workout.actualAverageHeartRate,
      actualMaxHeartRate: workout.actualMaxHeartRate,
      actualDurationSeconds: workout.actualDurationSeconds,
      actualDistanceMeters: workout.actualDistanceMeters,
      activityName: workout.matched_activity.activityName,
      activityType: workout.matched_activity.activityType,
    },
    athleteBaseline: {
      fiveKPace: athlete.fiveKPace,
      thresholdPace: athlete.thresholdPace,
      aerobicCeilingBpm: athlete.aerobicCeilingBpm,
    },
  };

  const systemPrompt = `You are an encouraging running coach. The athlete may or may not have followed a structured plan workout — many runs are standalone easy runs from their watch.

You only have activity *summary* stats (no second-by-second HR stream). Infer effort pattern cautiously from avg HR, max HR if present, pace, duration, and distance.

Respond with ONLY a JSON object (no markdown) with this exact shape:
{
  "narrative": "2-5 short sentences: what this run suggests about aerobic load, whether it looks sustainable/easy, and one practical takeaway. Do not shame. If there is no plan target, judge against easy aerobic norms using the athlete baseline HR ceiling and paces.",
  "hrPattern": one of "steady","drift_up","drift_down","variable","unknown",
  "effortQuality": one of "on_target","above","below","unknown" relative to what makes sense for this session type,
  "recommendation": null OR an object with:
    "field": either "aerobicCeilingBpm" OR "fiveKPaceSecPerMile",
    "suggestedValue": integer — for aerobicCeilingBpm: plausible easy upper HR (80-210). For fiveKPaceSecPerMile: seconds per mile for current 5K fitness (240-840 range, lower=faster).
    "reason": one sentence why.
  Only suggest a change when evidence supports it (e.g. easy run held well below ceiling for meaningful duration, or interval-quality signal). Otherwise set "recommendation": null.`;

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
      return;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("runRunAssessment fetch:", e);
    return;
  }

  const analysis = parseAssessmentJson(content);
  if (!analysis) {
    console.warn("runRunAssessment: could not parse model output");
    return;
  }

  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: { analysisJson: analysis as object, updatedAt: new Date() },
  });
}
