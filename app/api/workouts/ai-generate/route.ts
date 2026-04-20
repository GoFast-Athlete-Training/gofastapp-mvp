import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  resolveGoalPaceSecondsPerMile,
  getTrainingPaces,
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
  type TrainingPaces,
} from "@/lib/workout-generator/pace-calculator";
import {
  getTemplateSegments,
  descriptorsToApiSegments,
  type ApiSegment,
} from "@/lib/workout-generator/templates";

export const dynamic = "force-dynamic";

export interface AiGenerateRequestBody {
  /** Paste from Runna, coach, Strava, etc. — "15 miles today doing x, y, z". When set, we parse with AI and match to our segment model. */
  sourceText?: string;
  workoutType?: string;
  totalMiles?: number;
  goalPace?: string;
  raceTime?: string;
  raceDistance?: string;
  freeformPrompt?: string;
}

export interface AiGenerateResponse {
  segments: ApiSegment[];
  suggestedTitle: string;
  suggestedDescription: string;
}

/** Allowed workout types for blob path; contract with create page. */
const BLOB_WORKOUT_TYPES = ["Easy", "Tempo", "LongRun", "Intervals", "Race"] as const;

/**
 * Normalize request body for blob path. Contract: { sourceText, workoutType } only.
 * Ensures workoutType is one of BLOB_WORKOUT_TYPES; defaults to "Easy".
 */
function normalizeBlobRequest(body: AiGenerateRequestBody): { sourceText: string; workoutType: string } {
  const rawType = body.workoutType ?? "Easy";
  const workoutType = BLOB_WORKOUT_TYPES.includes(rawType as (typeof BLOB_WORKOUT_TYPES)[number])
    ? rawType
    : "Easy";
  const sourceText = body.sourceText != null ? String(body.sourceText).trim() : "";
  return { sourceText, workoutType };
}

/** Convert pace string "8:15" to internal value (sec/mile * 1.60934) for API targets */
function paceStringToInternalValue(paceStr: string): number {
  const secPerMile = parsePaceToSecondsPerMile(paceStr.trim());
  return secondsPerMileToSecondsPerKm(secPerMile);
}

/**
 * Normalize OpenAI blob response to our API contract (ApiSegment[], suggestedTitle, suggestedDescription).
 * Handles malformed or extra keys. If AI returns PACE targets as paceLow/paceHigh strings (M:SS/mile), converts to valueLow/valueHigh.
 */
function normalizeOpenAIBlobResponse(parsed: unknown, sourceText: string): AiGenerateResponse {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const rawSegments = Array.isArray(obj.segments)
    ? obj.segments
    : Array.isArray(obj.steps)
      ? obj.steps
      : [];
  const segments: ApiSegment[] = rawSegments
    .map((s: unknown, i: number) => {
      if (!s || typeof s !== "object") return null;
      const seg = s as Record<string, unknown>;
      const stepOrder = typeof seg.stepOrder === "number" ? seg.stepOrder : i + 1;
      const title = typeof seg.title === "string" ? seg.title : "Segment";
      const durationType =
        seg.durationType === "TIME" ? "TIME" : "DISTANCE";
      const durationValue =
        typeof seg.durationValue === "number" && seg.durationValue > 0
          ? seg.durationValue
          : 0;
      const rawTargets = Array.isArray(seg.targets) ? seg.targets : [];
      const targets: Array<{ type: string; valueLow?: number; valueHigh?: number }> = [];
      for (const t of rawTargets) {
        if (!t || typeof t !== "object" || typeof (t as Record<string, unknown>).type !== "string")
          continue;
        const tt = t as Record<string, unknown>;
        const typeUpper = String(tt.type).toUpperCase();
        if (typeUpper === "PACE") {
          const paceLow = typeof tt.paceLow === "string" ? tt.paceLow.trim() : null;
          const paceHigh = typeof tt.paceHigh === "string" ? tt.paceHigh.trim() : null;
          if (paceLow || paceHigh) {
            try {
              const low = paceLow ? paceStringToInternalValue(paceLow) : (paceHigh ? paceStringToInternalValue(paceHigh) : 0);
              const high = paceHigh ? paceStringToInternalValue(paceHigh) : low;
              targets.push({ type: "PACE", valueLow: Math.min(low, high), valueHigh: Math.max(low, high) });
            } catch {
              // skip invalid pace
            }
          } else {
            const vl = typeof tt.valueLow === "number" && Number.isFinite(tt.valueLow) ? tt.valueLow : undefined;
            const vh = typeof tt.valueHigh === "number" && Number.isFinite(tt.valueHigh) ? tt.valueHigh : undefined;
            const vv = typeof tt.value === "number" && Number.isFinite(tt.value) ? tt.value : undefined;
            if (vl != null && vh != null) {
              targets.push({
                type: "PACE",
                valueLow: Math.min(vl, vh),
                valueHigh: Math.max(vl, vh),
              });
            } else if (vv != null) {
              targets.push({ type: "PACE", valueLow: vv, valueHigh: vv });
            } else if (vl != null) {
              targets.push({ type: "PACE", valueLow: vl, valueHigh: vl });
            } else if (vh != null) {
              targets.push({ type: "PACE", valueLow: vh, valueHigh: vh });
            }
          }
        } else if (
          typeUpper === "HEART_RATE" &&
          typeof tt.valueLow === "number" &&
          typeof tt.valueHigh === "number"
        ) {
          targets.push({
            type: "HEART_RATE",
            valueLow: Math.min(tt.valueLow, tt.valueHigh),
            valueHigh: Math.max(tt.valueLow, tt.valueHigh),
          });
        }
      }
      const repeatCount =
        typeof seg.repeatCount === "number" && seg.repeatCount >= 1 ? seg.repeatCount : undefined;
      return {
        stepOrder,
        title,
        durationType,
        durationValue,
        targets: targets.length ? targets : undefined,
        repeatCount,
      } as ApiSegment;
    })
    .filter((s): s is ApiSegment => s !== null && s.durationValue > 0);
  const suggestedTitle =
    typeof obj.suggestedTitle === "string" && obj.suggestedTitle.trim()
      ? obj.suggestedTitle.trim()
      : "Parsed Workout";
  const suggestedDescription =
    typeof obj.suggestedDescription === "string" && obj.suggestedDescription.trim()
      ? obj.suggestedDescription.trim()
      : sourceText.slice(0, 200);
  return { segments, suggestedTitle, suggestedDescription };
}

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

function buildSuggestedTitle(
  workoutType: string,
  totalMiles: number,
  _paces: TrainingPaces
): string {
  return `${workoutType} ${totalMiles} Miles`;
}

function buildSuggestedDescription(
  workoutType: string,
  totalMiles: number,
  paces: TrainingPaces
): string {
  return `AI-generated ${workoutType} workout, ${totalMiles} miles total. Goal pace ${formatPaceFromSecondsPerMile(paces.goalSecondsPerMile)}.`;
}

async function refineWithOpenAI(
  workoutType: string,
  totalMiles: number,
  paces: TrainingPaces,
  baseSegments: ApiSegment[],
  freeformPrompt: string
): Promise<{ segments: ApiSegment[]; suggestedTitle: string; suggestedDescription: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      segments: baseSegments,
      suggestedTitle: buildSuggestedTitle(workoutType, totalMiles, paces),
      suggestedDescription: buildSuggestedDescription(workoutType, totalMiles, paces),
    };
  }

  const paceContext = [
    `Goal pace: ${formatPaceFromSecondsPerMile(paces.goalSecondsPerMile)}`,
    `Easy: ${formatPaceFromSecondsPerMile(paces.easy)}`,
    `Tempo: ${formatPaceFromSecondsPerMile(paces.tempo)}`,
    `Long run: ${formatPaceFromSecondsPerMile(paces.longRun)}`,
    `Interval: ${formatPaceFromSecondsPerMile(paces.interval)}`,
    `Speed: ${formatPaceFromSecondsPerMile(paces.speed)}`,
    `Recovery: ${formatPaceFromSecondsPerMile(paces.recovery)}`,
  ].join(", ");

  const systemPrompt = `You are a running coach. Generate a structured workout as JSON.
Workout type: ${workoutType}. Total distance: ${totalMiles} miles.
Pace zones (use these seconds-per-km ranges for targets): ${paceContext}
Current template segments (you may adjust based on user request): ${JSON.stringify(baseSegments)}

Respond with ONLY a single JSON object of this shape (no markdown, no code block):
{
  "segments": [ { "stepOrder": 1, "title": "Warmup", "durationType": "DISTANCE", "durationValue": 1.5, "targets": [ { "type": "PACE", "valueLow": 520, "valueHigh": 540 } ] }, ... ],
  "suggestedTitle": "string",
  "suggestedDescription": "string"
}
Each segment must have: stepOrder (1-based), title, durationType ("DISTANCE" or "TIME"), durationValue (miles or minutes), targets (array with type "PACE" and valueLow/valueHigh in seconds per km). Optional: repeatCount for intervals.`;

  const userPrompt = `User request: ${freeformPrompt}. Return the workout JSON only.`;

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI API error:", res.status, err);
    return {
      segments: baseSegments,
      suggestedTitle: buildSuggestedTitle(workoutType, totalMiles, paces),
      suggestedDescription: buildSuggestedDescription(workoutType, totalMiles, paces),
    };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return {
      segments: baseSegments,
      suggestedTitle: buildSuggestedTitle(workoutType, totalMiles, paces),
      suggestedDescription: buildSuggestedDescription(workoutType, totalMiles, paces),
    };
  }

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as AiGenerateResponse;
    if (Array.isArray(parsed.segments) && parsed.segments.length > 0) {
      return {
        segments: parsed.segments,
        suggestedTitle: parsed.suggestedTitle ?? buildSuggestedTitle(workoutType, totalMiles, paces),
        suggestedDescription:
          parsed.suggestedDescription ?? buildSuggestedDescription(workoutType, totalMiles, paces),
      };
    }
  } catch (_) {
    // fall through to template result
  }
  return {
    segments: baseSegments,
    suggestedTitle: buildSuggestedTitle(workoutType, totalMiles, paces),
    suggestedDescription: buildSuggestedDescription(workoutType, totalMiles, paces),
  };
}

/** Parse a pasted workout description (Runna, coach, Strava) into our segment model via OpenAI. */
async function parseSourceTextWithOpenAI(
  sourceText: string,
  workoutType: string = "Easy"
): Promise<AiGenerateResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to parse workout from description");
  }

  const systemPrompt = `You are a running coach. The user pasted a workout description (e.g. from Runna, a coach, or Strava) like "15 miles today - 2 mile warmup, 10 at marathon pace, 3 cooldown". Your job is to parse it into our structured workout format.

The user has indicated workout type: ${workoutType}. Prefer segment titles that match this type (e.g. Warmup, Rest, Interval, Cooldown) and bias suggestedTitle toward ${workoutType} when appropriate.

Heart rate zones (use for HEART_RATE targets when user says "zone N" or "zN" or "easy/zone 2" etc.): Zone 1: 100-115 bpm, Zone 2: 115-130 bpm, Zone 3: 130-145 bpm, Zone 4: 145-160 bpm, Zone 5: 160-175 bpm. If the description mentions a zone (e.g. "zone 2", "keep it in z2") add a target: { "type": "HEART_RATE", "valueLow": <min>, "valueHigh": <max> } in bpm. You can have both PACE and HEART_RATE in the same segment targets array.

Output ONLY a single JSON object (no markdown, no code block). For PACE targets use paceLow and paceHigh as M:SS/mile strings (e.g. "8:15", "8:45"):
{
  "segments": [
    { "stepOrder": 1, "title": "Main", "durationType": "DISTANCE", "durationValue": 6, "targets": [ { "type": "PACE", "paceLow": "8:15", "paceHigh": "8:45" } ] }
  ],
  "suggestedTitle": "easy run - 6 miles",
  "suggestedDescription": "6 miles easy at 8:15-8:45 pace"
}

When the user explicitly mentions warmup or cooldown (e.g. "2 mi warmup", "cooldown 2 miles"), use multiple segments with titles "Warmup", "Main", "Cooldown". Example with warmup/cooldown:
{
  "segments": [
    { "stepOrder": 1, "title": "Warmup", "durationType": "DISTANCE", "durationValue": 2, "targets": [ { "type": "PACE", "paceLow": "8:45", "paceHigh": "9:00" } ] },
    { "stepOrder": 2, "title": "Main", "durationType": "DISTANCE", "durationValue": 10, "targets": [ { "type": "PACE", "paceLow": "7:30", "paceHigh": "7:45" } ] },
    { "stepOrder": 3, "title": "Cooldown", "durationType": "DISTANCE", "durationValue": 3, "targets": [ { "type": "PACE", "paceLow": "8:45", "paceHigh": "9:00" } ] }
  ],
  "suggestedTitle": "marathon pace - 15 miles",
  "suggestedDescription": "2 mi warmup, 10 mi marathon pace, 3 mi cooldown"
}

Rules:
- Tabular splits: If each non-empty line is exactly "DISTANCE PACE PACE" (miles or decimal miles, then two M:SS/mile paces), output ONE segment per line with titles "Segment 1", "Segment 2", … and the given distance and pace band. Do not merge these into a single segment.
- Distance vs time: For outdoor road/track runs, use durationType "DISTANCE" and durationValue in miles whenever the user gives miles or km (convert km to miles). Use "TIME" with minutes only when they specify duration without distance (e.g. "90 minutes easy"). Do not put minutes into durationValue when the segment is meant to be miles.
- Default (non-tabular): If the user does NOT explicitly mention warmup or cooldown (or warm-up, cool-down), return ONE segment only with title "Main" or "Main Work" or "Easy" containing the full distance. Do not infer or add Warmup/Cooldown.
- Only output segments titled "Warmup" or "Cooldown" when the user's text explicitly mentions them (e.g. "2 mile warmup", "warm up 1 mi", "cooldown 2 miles").
- Each segment: stepOrder (1-based), title, durationType ("DISTANCE" or "TIME"), durationValue (miles or minutes), targets. For intervals use repeatCount (e.g. 6x800m = durationValue 0.5 miles, repeatCount 6).
- PACE targets: "paceLow" and "paceHigh" as M:SS/mile strings (e.g. "8:15", "8:45"). HEART_RATE: valueLow/valueHigh in bpm when user mentions zone 1-5.
- suggestedTitle: short, literal, based on user wording (e.g. "easy run - 6 miles", "tempo - 8 miles"). NEVER include pace, times, or heart rate in the title. suggestedDescription: one line summary; pace/details may go here.`;

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
        { role: "user", content: `Parse this workout into structured segments:\n\n${sourceText}` },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI parse error:", res.status, err);
    throw new Error("AI parsing failed");
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
  const result = normalizeOpenAIBlobResponse(parsed, sourceText);
  if (result.segments.length === 0) {
    throw new Error("AI did not return valid segments");
  }
  return result;
}

/**
 * POST /api/workouts/ai-generate
 * Two paths:
 * 1) sourceText: paste from Runna/coach/Strava — parse with AI and match to our segment model.
 * 2) workoutType + totalMiles + goalPace (or raceTime/raceDistance): template-based with optional freeform refinement.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = (await request.json()) as AiGenerateRequestBody;
    const {
      totalMiles,
      goalPace,
      raceTime,
      raceDistance,
      freeformPrompt,
    } = body;

    const { sourceText, workoutType } = normalizeBlobRequest(body);
    const hasSourceText = sourceText.length > 0;
    const hasStructured =
      totalMiles != null &&
      totalMiles > 0 &&
      (goalPace != null && String(goalPace).trim() || (raceTime != null && raceDistance != null));

    if (hasSourceText) {
      const result = await parseSourceTextWithOpenAI(sourceText, workoutType);
      return NextResponse.json(result);
    }

    if (!hasStructured) {
      return NextResponse.json(
        {
          error:
            "Provide either a pasted workout description (sourceText) or totalMiles plus goal pace or race time.",
        },
        { status: 400 }
      );
    }

    const goalSecPerMile = resolveGoalPaceSecondsPerMile({
      goalPace,
      raceTime,
      raceDistance,
    });
    const paces = getTrainingPaces(goalSecPerMile);
    const descriptors = getTemplateSegments(workoutType, totalMiles, paces);
    const baseSegments = descriptorsToApiSegments(descriptors, paces);

    let result: AiGenerateResponse;
    if (freeformPrompt?.trim()) {
      result = await refineWithOpenAI(
        workoutType,
        totalMiles,
        paces,
        baseSegments,
        freeformPrompt.trim()
      );
    } else {
      result = {
        segments: baseSegments,
        suggestedTitle: buildSuggestedTitle(workoutType, totalMiles, paces),
        suggestedDescription: buildSuggestedDescription(workoutType, totalMiles, paces),
      };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI generate failed";
    console.error("Error in ai-generate:", error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
