/**
 * OpenAI coach generate for Build-a-run (athlete context, not pasted text).
 */

import {
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/workout-generator/pace-calculator";
import { loadRecentRunLoad } from "@/lib/training/recent-run-load";
import type { WorkoutStep } from "@/lib/training/prescription";

export type CoachGenerateInput = {
  athleteId: string;
  fiveKPace: string | null | undefined;
  thresholdPace: string | null | undefined;
  workoutType: string;
  generatePrompt: string;
  asOfDateKey: string;
};

export type CoachGenerateResult = {
  segments: WorkoutStep[];
  suggestedTitle: string;
  suggestedDescription: string;
};

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

function paceStringToInternalValue(paceStr: string): number {
  const secPerMile = parsePaceToSecondsPerMile(paceStr.trim());
  return secondsPerMileToSecondsPerKm(secPerMile);
}

function normalizeCoachGenerateResponse(parsed: unknown): CoachGenerateResult | null {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const segments: WorkoutStep[] = rawSegments
    .map((s: unknown, i: number) => {
      if (!s || typeof s !== "object") return null;
      const seg = s as Record<string, unknown>;
      const stepOrder = typeof seg.stepOrder === "number" ? seg.stepOrder : i + 1;
      const title = typeof seg.title === "string" ? seg.title : "Segment";
      const durationType = seg.durationType === "TIME" ? "TIME" : "DISTANCE";
      const durationValue =
        typeof seg.durationValue === "number" && seg.durationValue > 0 ? seg.durationValue : 0;
      const rawTargets = Array.isArray(seg.targets) ? seg.targets : [];
      const targets: Array<{ type: string; valueLow?: number; valueHigh?: number }> = [];
      for (const t of rawTargets) {
        if (!t || typeof t !== "object") continue;
        const tt = t as Record<string, unknown>;
        const typeUpper = String(tt.type ?? "").toUpperCase();
        if (typeUpper === "PACE") {
          const paceLow = typeof tt.paceLow === "string" ? tt.paceLow.trim() : null;
          const paceHigh = typeof tt.paceHigh === "string" ? tt.paceHigh.trim() : null;
          if (paceLow || paceHigh) {
            try {
              const low = paceLow
                ? paceStringToInternalValue(paceLow)
                : paceHigh
                  ? paceStringToInternalValue(paceHigh)
                  : 0;
              const high = paceHigh ? paceStringToInternalValue(paceHigh) : low;
              targets.push({
                type: "PACE",
                valueLow: Math.min(low, high),
                valueHigh: Math.max(low, high),
              });
            } catch {
              /* skip */
            }
          } else if (
            typeof tt.valueLow === "number" &&
            typeof tt.valueHigh === "number"
          ) {
            targets.push({
              type: "PACE",
              valueLow: tt.valueLow,
              valueHigh: tt.valueHigh,
            });
          }
        }
      }
      const repeatCount =
        typeof seg.repeatCount === "number" && seg.repeatCount > 1 ? seg.repeatCount : undefined;
      return {
        stepOrder,
        title,
        durationType,
        durationValue,
        targets: targets.length ? targets : undefined,
        repeatCount,
      } as WorkoutStep;
    })
    .filter((s): s is WorkoutStep => s !== null && s.durationValue > 0);

  if (segments.length === 0) return null;

  const suggestedTitle =
    typeof obj.suggestedTitle === "string" && obj.suggestedTitle.trim()
      ? obj.suggestedTitle.trim()
      : "Workout";
  const suggestedDescription =
    typeof obj.suggestedDescription === "string" && obj.suggestedDescription.trim()
      ? obj.suggestedDescription.trim()
      : "";

  return { segments, suggestedTitle, suggestedDescription };
}

export async function coachGenerateStandaloneWorkout(
  input: CoachGenerateInput
): Promise<CoachGenerateResult> {
  const hasFiveK = Boolean(input.fiveKPace?.trim());
  const hasThreshold = Boolean(input.thresholdPace?.trim());
  const recent = await loadRecentRunLoad({
    athleteId: input.athleteId,
    asOfDateKey: input.asOfDateKey,
    lookbackDays: 7,
  });
  const hasRecentRuns = recent.days.length > 0;

  if (!hasFiveK && !hasThreshold && !hasRecentRuns) {
    throw new Error(
      "Add a 5K or threshold pace on your profile, or sync a recent run, so we can build a workout for you."
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate workouts");
  }

  let fiveKLine = "5K pace: unknown";
  if (hasFiveK) {
    try {
      const sec = parsePaceToSecondsPerMile(input.fiveKPace!.trim());
      fiveKLine = `5K pace: ${formatPaceFromSecondsPerMile(sec)}`;
    } catch {
      fiveKLine = `5K pace (profile): ${input.fiveKPace!.trim()}`;
    }
  }

  let thresholdLine = "Threshold pace: unknown";
  if (hasThreshold) {
    try {
      const sec = parsePaceToSecondsPerMile(input.thresholdPace!.trim());
      thresholdLine = `Threshold pace: ${formatPaceFromSecondsPerMile(sec)}`;
    } catch {
      thresholdLine = `Threshold pace (profile): ${input.thresholdPace!.trim()}`;
    }
  }

  const recentLines =
    recent.days.length === 0
      ? "Recent runs (7 days): none on file"
      : `Recent runs (7 days):\n${recent.days
          .slice(0, 8)
          .map((d) => {
            const mi = d.distanceMiles != null ? `${d.distanceMiles} mi` : "? mi";
            const pace =
              d.avgPaceSecPerMile != null
                ? formatPaceFromSecondsPerMile(d.avgPaceSecPerMile)
                : "?";
            const name = d.activityName?.trim() || "Run";
            return `- ${d.dateKey}: ${name}, ${mi} @ ${pace}/mi`;
          })
          .join("\n")}`;

  const userAsk = input.generatePrompt.trim() || `Suggest a sensible ${input.workoutType} run for today.`;

  const systemPrompt = `You are a running coach building a structured workout for GoFast.
Use the athlete context to choose distance, warmup/cooldown when appropriate, and pace bands as M:SS/mile in JSON.
Workout type hint: ${input.workoutType}.

Athlete context:
${fiveKLine}
${thresholdLine}
${recentLines}

Output ONLY a single JSON object (no markdown):
{
  "segments": [
    { "stepOrder": 1, "title": "Warmup", "durationType": "DISTANCE", "durationValue": 2, "targets": [ { "type": "PACE", "paceLow": "8:30", "paceHigh": "9:00" } ] }
  ],
  "suggestedTitle": "tempo - 8 miles",
  "suggestedDescription": "one line summary"
}

Rules:
- Order segments as run order: Warmup (optional), main work, Cooldown (optional).
- PACE targets use paceLow and paceHigh as M:SS/mile strings.
- suggestedTitle: short, no pace numbers in title.
- Match the user's request when provided; otherwise fit recent load and threshold.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userAsk },
      ],
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI coach generate error:", res.status, err);
    throw new Error("AI workout generation failed");
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI did not return valid JSON");
  }

  const result = normalizeCoachGenerateResponse(parsed);
  if (!result) throw new Error("AI did not return valid segments");
  return result;
}
