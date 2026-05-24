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
  rec: AiAssessmentRaw["recommendation"],
  workoutType: string
): RunAnalysisJsonV1["recommendation"] {
  if (!rec || rec.field == null || rec.suggestedValue == null) return null;
  const field = String(rec.field).trim();
  const sv = Number(rec.suggestedValue);
  if (!Number.isFinite(sv) || sv <= 0) return null;

  const type = workoutType.trim();
  if (field === "fiveKPaceSecPerMile" && (type === "LongRun" || type === "Easy")) {
    return null;
  }

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

function parseAssessmentJson(
  raw: string,
  workoutType: string
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
    recommendation: normalizeRecommendation(parsed.recommendation, workoutType),
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
        estimatedDistanceInMeters: true,
        segments: {
          orderBy: { stepOrder: "asc" },
          select: {
            segment_laps: {
              orderBy: { lapIndex: "asc" },
              select: {
                lapIndex: true,
                avgPaceSecPerMile: true,
                avgHeartRate: true,
                distanceMiles: true,
                durationSeconds: true,
              },
            },
          },
        },
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

  if (!workout?.matched_activity) {
    return;
  }
  if (!athlete) {
    return;
  }

  const hasPlanTargets =
    workout.targetPaceSecPerMile != null || workout.hrDeltaBpm != null;

  const lapsOrdered: Array<{
    lapOrder: number;
    garminLapIndex: number;
    paceSecPerMile: number | null;
    avgHeartRate: number | null;
    distanceMiles: number | null;
    durationSeconds: number | null;
  }> = [];
  let ord = 0;
  for (const seg of workout.segments ?? []) {
    for (const lap of seg.segment_laps ?? []) {
      ord += 1;
      lapsOrdered.push({
        lapOrder: ord,
        garminLapIndex: lap.lapIndex,
        paceSecPerMile: lap.avgPaceSecPerMile,
        avgHeartRate: lap.avgHeartRate,
        distanceMiles: lap.distanceMiles,
        durationSeconds: lap.durationSeconds,
      });
    }
  }

  const plannedMeters = workout.estimatedDistanceInMeters;
  const actualMeters = workout.actualDistanceMeters;
  const distanceRatio =
    plannedMeters != null && plannedMeters > 0 && actualMeters != null && actualMeters > 0
      ? actualMeters / plannedMeters
      : null;
  const elevationGainFt =
    workout.matched_activity.elevationGain != null &&
    Number.isFinite(workout.matched_activity.elevationGain)
      ? Math.round(workout.matched_activity.elevationGain * 3.28084)
      : null;

  const payload = {
    workout: {
      title: workout.title,
      workoutType: workout.workoutType,
      hasPlanTargets,
      plannedDistanceMeters: plannedMeters,
      actualDistanceMeters: actualMeters,
      distanceRatio,
      elevationGainFt,
      targetPaceSecPerMile: workout.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
      paceDeltaSecPerMile: workout.paceDeltaSecPerMile,
      hrDeltaBpm: workout.hrDeltaBpm,
      actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
      actualAverageHeartRate: workout.actualAverageHeartRate,
      actualMaxHeartRate: workout.actualMaxHeartRate,
      actualDurationSeconds: workout.actualDurationSeconds,
      activityName: workout.matched_activity.activityName,
      activityType: workout.matched_activity.activityType,
    },
    /// Per-lap snapshot when Garmin detail synced; empty otherwise.
    laps: lapsOrdered,
    athleteBaseline: {
      fiveKPace: athlete.fiveKPace,
      thresholdPace: athlete.thresholdPace,
      aerobicCeilingBpm: athlete.aerobicCeilingBpm,
    },
  };

  const hasLapDetail = lapsOrdered.length > 0;

  const workoutType = workout.workoutType;
  const isLongOrEasy = workoutType === "LongRun" || workoutType === "Easy";

  const systemPrompt = `You are an encouraging running coach. The athlete may or may not have followed a structured plan workout — many runs are standalone easy runs from their watch.

You have activity *summary* stats (no second-by-second HR stream). If the user payload includes a non-empty "laps" array, these are ordered lap splits (often ~1 mile each). Use them to describe **where** pace changed (e.g. "strong through lap 8, faded lap 10–12") — cite lap numbers rather than guessing. When laps are empty or too few to infer splits, infer cautiously from summary only.

**Run shape first:** Before interpreting pace vs plan, consider actual vs planned distance (distanceRatio), elevationGainFt, lap splits, and average/max HR. A long run that was much longer than planned and/or had substantial climbing makes average pace hard to interpret without context.

**LongRun and Easy sessions:** Do NOT recommend fiveKPaceSecPerMile profile updates. If actual distance is meaningfully above planned (distanceRatio > 1.1) or pace is slower than target, prioritize asking what shaped the run (intentionally extended, group run, hills/terrain, heat, fueling practice) rather than suggesting faster paces. Avoid language like "targeting a faster pace will help" unless the run was near planned distance, effort looked clearly low-risk, and evidence is strong.

**Profile recommendations:** Only suggest a change when evidence supports it:
- fiveKPaceSecPerMile: quality workouts (Tempo, Intervals, SpeedDuration) with clear pace signal — never for LongRun or Easy.
- aerobicCeilingBpm: easy aerobic ceiling updates when HR and duration evidence is strong.
Otherwise set "recommendation": null.

Respond with ONLY a JSON object (no markdown) with this exact shape:
{
  "narrative": "2-5 short sentences: describe run shape (splits, distance vs plan, elevation if present), relate to plan targets when they exist, and ask for context when distance/pace differ meaningfully. Do not shame. ${
    hasLapDetail
      ? "When laps are provided, mention specific lap ranges where pace shifted."
      : ""
  } If there is no plan target, judge against easy aerobic norms using the athlete baseline HR ceiling and paces.",
  "hrPattern": one of "steady","drift_up","drift_down","variable","unknown",
  "effortQuality": one of "on_target","above","below","unknown" relative to what makes sense for this session type,
  "recommendation": null OR an object with:
    "field": either "aerobicCeilingBpm" OR "fiveKPaceSecPerMile",
    "suggestedValue": integer — for aerobicCeilingBpm: plausible easy upper HR (80-210). For fiveKPaceSecPerMile: seconds per mile for current 5K fitness (240-840 range, lower=faster) — only for quality workout types, never LongRun/Easy.
    "reason": one sentence why.
  Only suggest a change when evidence supports it. Otherwise set "recommendation": null.`;

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

  const analysis = parseAssessmentJson(content, workoutType);
  if (!analysis) {
    console.warn("runRunAssessment: could not parse model output");
    return;
  }

  if (isLongOrEasy && analysis.recommendation?.field === "fiveKPaceSecPerMile") {
    analysis.recommendation = null;
  }

  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: { analysisJson: analysis as object, updatedAt: new Date() },
  });
}
