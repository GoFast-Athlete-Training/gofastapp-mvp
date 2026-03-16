import { NextRequest, NextResponse } from "next/server";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  resolveGoalPaceSecondsPerMile,
  getTrainingPaces,
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

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

function buildSuggestedTitle(
  workoutType: string,
  totalMiles: number,
  paces: TrainingPaces
): string {
  const paceStr = formatPaceFromSecondsPerMile(paces.goalSecondsPerMile);
  return `${totalMiles} Mile ${workoutType} @ ${paceStr}`;
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

Output ONLY a single JSON object (no markdown, no code block):
{
  "segments": [
    { "stepOrder": 1, "title": "Warmup", "durationType": "DISTANCE", "durationValue": 2, "targets": [ { "type": "PACE", "valueLow": 520, "valueHigh": 560 } ] },
    { "stepOrder": 2, "title": "Main", "durationType": "DISTANCE", "durationValue": 10, "targets": [ { "type": "PACE", "valueLow": 450, "valueHigh": 480 } ] },
    { "stepOrder": 3, "title": "Cooldown", "durationType": "DISTANCE", "durationValue": 3, "targets": [ { "type": "PACE", "valueLow": 520, "valueHigh": 560 } ] }
  ],
  "suggestedTitle": "15 Mile Long Run",
  "suggestedDescription": "2 mi warmup, 10 mi marathon pace, 3 mi cooldown"
}

Rules:
- Each segment: stepOrder (1-based), title (e.g. Warmup, Main Set, Cooldown, Interval, Recovery), durationType ("DISTANCE" or "TIME"), durationValue (miles for DISTANCE, minutes for TIME).
- For intervals/repeats use repeatCount on that segment (e.g. 6x800m = one segment with durationValue 0.5 miles, repeatCount 6).
- targets: array of { "type": "PACE", "valueLow": N, "valueHigh": N } in seconds per kilometer. Infer reasonable paces from context (e.g. warmup/cooldown ~8:30/mi = ~530 sec/km, marathon pace ~7:30/mi = ~467 sec/km, tempo ~7:00/mi = ~436 sec/km). Use ±10 sec/km range.
- suggestedTitle: short workout name. suggestedDescription: one line summarizing the workout.`;

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
  const parsed = JSON.parse(cleaned) as AiGenerateResponse;
  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    throw new Error("AI did not return valid segments");
  }
  return {
    segments: parsed.segments,
    suggestedTitle: parsed.suggestedTitle ?? "Parsed Workout",
    suggestedDescription: parsed.suggestedDescription ?? sourceText.slice(0, 200),
  };
}

/**
 * POST /api/workouts/ai-generate
 * Two paths:
 * 1) sourceText: paste from Runna/coach/Strava — parse with AI and match to our segment model.
 * 2) workoutType + totalMiles + goalPace (or raceTime/raceDistance): template-based with optional freeform refinement.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = (await request.json()) as AiGenerateRequestBody;
    const {
      sourceText,
      workoutType = "Easy",
      totalMiles,
      goalPace,
      raceTime,
      raceDistance,
      freeformPrompt,
    } = body;

    const hasSourceText = sourceText != null && String(sourceText).trim().length > 0;
    const hasStructured =
      totalMiles != null &&
      totalMiles > 0 &&
      (goalPace != null && String(goalPace).trim() || (raceTime != null && raceDistance != null));

    if (hasSourceText) {
      const result = await parseSourceTextWithOpenAI(String(sourceText).trim(), workoutType);
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
