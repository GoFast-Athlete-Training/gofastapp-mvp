import type { GroupWorkoutParseResult, GroupWorkoutSegmentInput } from "./types";

const METERS_TO_MILES = 1 / 1609.34;

function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES * 1000) / 1000;
}

/** e.g. "8 x 1600", "8x1600m", "4-5 x 800m w/ 400 jog" */
function tryParseTrackIntervalLine(text: string): GroupWorkoutSegmentInput[] | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const atIdx = normalized.indexOf("@");
  let workPart = (atIdx >= 0 ? normalized.slice(0, atIdx) : normalized).trim();
  const effortFromAt = atIdx >= 0 ? normalized.slice(atIdx + 1).trim() : null;

  let recoveryDurationType: string | null = null;
  let recoveryDurationValue: number | null = null;
  const recoveryMatch = workPart.match(
    /(?:w\/|with)\s*(\d+(?:\.\d+)?)\s*(m|mi|mile|miles|km|min|minute|minutes)?\s*(?:jog|recovery|rest)?/i
  );
  if (recoveryMatch && recoveryMatch.index != null) {
    workPart = workPart.slice(0, recoveryMatch.index).trim();
    const recRaw = parseFloat(recoveryMatch[1]);
    const recUnit = (recoveryMatch[2] || "m").toLowerCase();
    if (Number.isFinite(recRaw) && recRaw > 0) {
      if (recUnit.startsWith("min")) {
        recoveryDurationType = "TIME";
        recoveryDurationValue = recRaw;
      } else if (recUnit === "mi" || recUnit === "mile" || recUnit === "miles") {
        recoveryDurationType = "DISTANCE";
        recoveryDurationValue = recRaw;
      } else if (recUnit === "km") {
        recoveryDurationType = "DISTANCE";
        recoveryDurationValue = Math.round((recRaw / 1.60934) * 1000) / 1000;
      } else {
        recoveryDurationType = "DISTANCE";
        recoveryDurationValue = metersToMiles(recRaw);
      }
    }
  }

  const intervalMatch = workPart.match(
    /^(?:(\d+)\s*[-–]\s*)?(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|mi|mile|miles|km)?\s*$/i
  );
  if (!intervalMatch) return null;

  const repeatCount = parseInt(intervalMatch[2], 10);
  const distanceRaw = parseFloat(intervalMatch[3]);
  const unit = (intervalMatch[4] || "m").toLowerCase();
  if (!Number.isFinite(repeatCount) || repeatCount < 1 || !Number.isFinite(distanceRaw) || distanceRaw <= 0) {
    return null;
  }

  let workMiles: number;
  if (unit === "mi" || unit === "mile" || unit === "miles") {
    workMiles = distanceRaw;
  } else if (unit === "km") {
    workMiles = Math.round((distanceRaw / 1.60934) * 1000) / 1000;
  } else {
    workMiles = metersToMiles(distanceRaw);
  }

  const effortNote = effortFromAt || normalized.match(/@\s*(.+)$/i)?.[1]?.trim();
  const notes = effortNote ? `@ ${effortNote.replace(/^@\s*/, "")}` : null;

  return [
    {
      stepOrder: 1,
      title: "Intervals",
      durationType: "DISTANCE",
      durationValue: workMiles,
      repeatCount,
      targets: null,
      notes,
      recoveryDurationType,
      recoveryDurationValue,
    },
  ];
}

/** Split compound prescriptions: "4-5 x 800m; then 4 x 400m" */
function splitCompoundWorkoutText(text: string): string[] {
  return text
    .split(/;\s*|\n+|,\s*then\s+/i)
    .map((part) => part.trim().replace(/^then\s+/i, ""))
    .filter(Boolean);
}

export function tryParseTrackIntervalText(text: string): GroupWorkoutParseResult | null {
  const parts = splitCompoundWorkoutText(text);
  const segments: GroupWorkoutSegmentInput[] = [];
  let step = 1;

  for (const part of parts) {
    const parsed = tryParseTrackIntervalLine(part);
    if (!parsed) return null;
    for (const seg of parsed) {
      segments.push({ ...seg, stepOrder: step++ });
    }
  }

  if (segments.length === 0) return null;

  const summary = text.trim().slice(0, 120);
  return {
    segments,
    suggestedTitle: "Track workout",
    suggestedDescription: summary,
  };
}

async function parseGroupWorkoutWithOpenAI(
  sourceText: string,
  workoutType: string = "Intervals"
): Promise<GroupWorkoutParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to parse workout from description");
  }

  const systemPrompt = `You are a running coach parsing a GROUP track workout for a run club. There is NO individual athlete 5K pace — do NOT invent pace targets from effort labels like "5K pace", "marathon pace", "threshold", or "hard".

Workout type hint: ${workoutType}.

Output ONLY valid JSON (no markdown):
{
  "segments": [
    {
      "stepOrder": 1,
      "title": "Intervals",
      "durationType": "DISTANCE",
      "durationValue": 0.5,
      "repeatCount": 8,
      "notes": "@ 5K effort",
      "recoveryDurationType": "DISTANCE",
      "recoveryDurationValue": 0.25,
      "targets": null
    }
  ],
  "suggestedTitle": "Tuesday track intervals",
  "suggestedDescription": "8 x 800m @ 5K with 400m jog"
}

Rules:
- Use durationType DISTANCE with durationValue in miles (800m ≈ 0.5 mi, 1600m ≈ 1.0 mi, 400m ≈ 0.25 mi).
- Use repeatCount for reps (e.g. 8 x 800m → durationValue 0.5, repeatCount 8).
- Put effort cues ("@ 5K", "at tempo") in notes — NOT in targets.
- targets must be null unless the text gives explicit clock paces like "7:30/mile" or HR zones.
- For HR zones only when explicitly mentioned: { "type": "HEART_RATE", "valueLow": 115, "valueHigh": 130 }.
- Multiple sets ("then 4 x 400m") → separate segments with incrementing stepOrder.
- suggestedTitle: short, no pace numbers. suggestedDescription: one-line summary of the prescription.`;

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
        { role: "user", content: `Parse this group track workout:\n\n${sourceText}` },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI group workout parse error:", res.status, err);
    throw new Error("AI parsing failed");
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    segments?: unknown[];
    suggestedTitle?: string;
    suggestedDescription?: string;
  };

  const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : [];
  const segments: GroupWorkoutSegmentInput[] = rawSegments
    .map((s: unknown, i: number) => {
      if (!s || typeof s !== "object") return null;
      const seg = s as Record<string, unknown>;
      const durationType = seg.durationType === "TIME" ? "TIME" : "DISTANCE";
      const durationValue =
        typeof seg.durationValue === "number" && seg.durationValue > 0 ? seg.durationValue : 0;
      if (durationValue <= 0) return null;

      let targets: GroupWorkoutSegmentInput["targets"] = null;
      if (Array.isArray(seg.targets) && seg.targets.length > 0) {
        const filtered = seg.targets.filter(
          (t) =>
            t &&
            typeof t === "object" &&
            String((t as { type?: string }).type).toUpperCase() === "HEART_RATE"
        );
        targets = filtered.length > 0 ? (filtered as GroupWorkoutSegmentInput["targets"]) : null;
      }

      return {
        stepOrder: typeof seg.stepOrder === "number" ? seg.stepOrder : i + 1,
        title: typeof seg.title === "string" ? seg.title : "Segment",
        durationType,
        durationValue,
        repeatCount:
          typeof seg.repeatCount === "number" && seg.repeatCount >= 1 ? seg.repeatCount : null,
        notes: typeof seg.notes === "string" ? seg.notes.trim() || null : null,
        targets,
        recoveryDurationType:
          typeof seg.recoveryDurationType === "string" ? seg.recoveryDurationType : null,
        recoveryDurationValue:
          typeof seg.recoveryDurationValue === "number" ? seg.recoveryDurationValue : null,
      } satisfies GroupWorkoutSegmentInput;
    })
    .filter((s): s is GroupWorkoutSegmentInput => s !== null);

  if (segments.length === 0) throw new Error("AI did not return valid segments");

  return {
    segments,
    suggestedTitle:
      typeof parsed.suggestedTitle === "string" && parsed.suggestedTitle.trim()
        ? parsed.suggestedTitle.trim()
        : "Track workout",
    suggestedDescription:
      typeof parsed.suggestedDescription === "string" && parsed.suggestedDescription.trim()
        ? parsed.suggestedDescription.trim()
        : sourceText.slice(0, 200),
  };
}

export async function parseGroupWorkoutText(
  sourceText: string,
  workoutType: string = "Intervals"
): Promise<GroupWorkoutParseResult> {
  const text = sourceText.trim();
  if (!text) throw new Error("Workout text is required");

  const deterministic = tryParseTrackIntervalText(text);
  if (deterministic) return deterministic;

  return parseGroupWorkoutWithOpenAI(text, workoutType);
}
