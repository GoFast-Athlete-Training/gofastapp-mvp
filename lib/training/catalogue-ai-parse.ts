/**
 * Staff-style catalogue AI parse — athletes use the same prompt/normalization as Company.
 */

import {
  normalizeTrainingIntentArray,
  parseTrainingIntentFromCell,
} from "@/lib/training/catalogue-training-intents";

export function sanitizeCatalogueDescriptionInput(raw: string): string {
  return raw
    .replace(/\uFEFF/g, "")
    .replace(/\u2028/g, "\n")
    .replace(/\u2029/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function extractFirstJsonObject(text: string): string {
  const trimmed = text.replace(/^```(?:json)?\s*\n?|\n?```$/gim, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1).trim();
  return trimmed;
}

const SYSTEM_PROMPT = `You are a running coach assistant that converts natural language workout descriptions into JSON for the GoFast **workout catalogue** (used to build training plans).

Output one JSON object. Use these **exact** field names. Set unknown fields to null. Do not output intendedPhase, progressionIndex, or ladder fields — those are removed from the product schema.

INPUT STYLE (common coach paste)
Users often paste one blob with headings like: Workout:, Description, Structure, WU:, Main:, CD:, Rest:, Repeat Nx, Purpose:, etc. Treat the whole message as **one** workout. Map WU / warmup / Structure warmup lines → warmupMiles + warmupPaceOffsetSecPerMile; CD / cooldown → cooldownMiles + cooldownPaceOffsetSecPerMile; Main + Repeat → Intervals (workBaseReps, workBaseRepMeters, recoveryDistanceMeters, workBasePaceOffsetSecPerMile, etc.) or segmentPaceDist when appropriate.

IDENTITY
- "name": string — short title
- "description": string | null — one line summary (optional)
- "runSubType": string | null — short free-text label (e.g. "mp-block", "pyramid", "steady-tempo") when it helps disambiguate; else null
- "workoutType": "Easy" | "LongRun" | "Intervals" | "Tempo" | "Race" — use **Tempo** for steady threshold / "speed" blocks in miles (there is no SpeedDuration type anymore)
- "notes": string | null

purpose — optional coaching **sentence** (helps downstream summaries / athlete-facing context).
- "purpose": string | null — one plain-English line about why this workout exists or what the athlete should focus on (e.g. "Hold strong effort while changing pace"); omit or null if unsure.
- Do **not** output "trainingIntent" or coded tags (THRESHOLD, VO2_MAX, etc.). The product maps purpose onto catalogue trainingIntent.

WORKOUT TYPE — **Tempo vs Intervals** (common mistake: do not confuse terrain with track workouts)
- Use **Intervals** only when the text describes **structured repeats**: explicit rep counts, fixed rep distances (400m, 800m, 1600m, K repeats), track/road **interval** sessions, jog/rest between **discrete** hard bouts, or block-repeat meter ladders (see segmentPaceDist below).
- Use **Tempo** for **continuous or mile-based threshold work** on the run: sustained threshold, steady strong effort, **rolling hills** or **hilly routes** (undulating terrain — "rolling" here means **elevation profile**, not "rolling 400s"), hill **tempo**, strength-endurance over hills without a written "N × Xm" repeat scheme, progressive mile blocks, or fartlek described as one steady Tempo block.
- If the user says **"rolling hills"** with no meter repeat structure, default **Tempo** (optionally runSubType "rolling-hills") and model work in **miles** (workBaseMiles / tempo segmentPaceDist in miles), not Intervals. The phrase **"rolling 400s"** (or similar) is track turnover → **Intervals** block repeat in meters, not Tempo.

PACE ANCHOR (5K-fitness-based vs goal marathon pace)
- "paceAnchor": "currentBuildup" | "mpSimulation"

LongRun + mpSimulation (marathon pace long run — **fixed bookends, not percentages**):
- Set "warmupMiles" and "cooldownMiles" as concrete easy miles before/after goal MP work (typically 2 each if unknown).
- The product computes goal-MP mileage as scheduled long‑run miles minus those bookends — do NOT use warmupFraction/workFraction/cooldownFraction for this pattern.
- Set these to **null**: "warmupFraction", "workFraction", "cooldownFraction", "mpFraction", "mpTotalMiles", "mpBlockPosition", "mpBlockProgression" (use "flat" only if schema requires non-null downstream), "mpPaceOffsetSecPerMile".

Tempo + mpSimulation (still uses % of scheduled run for phases when the athlete wants MP‑anchored Tempo on a tempo slot):
- "warmupFraction" | "workFraction" | "cooldownFraction" — 0–1 shares of **total scheduled distance** when the user asks for % warmup/work/cool

INTERVALS (repeats, 400/800/1600, etc.): set these; usually leave workBaseMiles null
- "workBaseReps": number | null
- "workBaseRepMeters": number | null — meters per rep
- "recoveryDistanceMeters": number | null — jog distance between reps (**flat ladder** / legacy repeats). Omit with no recoveryDurationSeconds → default **400 m**. Use **0** only to disable distance-based jog (timed recovery may still apply).
- "recoveryDurationSeconds": number | null — optional **timed** recovery between those same reps (**seconds**, e.g. 90). If positive, materialization prefers **TIME** over distance. Omit if unused.
- "workBasePaceOffsetSecPerMile": number | null — vs 5K for each work rep
- "recoveryPaceOffsetSecPerMile": number | null

For multi-rep **pyramid** or varied distances, prefer "segmentPaceDist" (see below) with Intervals.

TEMPO / STEADY THRESHOLD (not discrete track reps)
- "workBaseMiles": number | null — main sustained work in **miles**
- "workPaceOffsetSecPerMile": number | null — sustained block vs paceAnchor
- "workBaseReps" and "workBaseRepMeters": null unless the text is true repeat intervals

segmentPaceDist (optional advanced) — JSON structure for prescriptions:
- For Tempo repeated blocks (same miles pattern + timed jog between full cycles): use an object exactly like:
  { "layout": "blockRepeat", "segments": [{ "miles": number, "paceOffsetSecPerMile": number }, ...], "repeatCount": number, "recoveryBetweenCyclesSeconds": number | omit }
- For Tempo multiple distinct mile blocks (progression, no full-block repeat): array of [{ "miles": number, "paceOffsetSecPerMile": number }]
- For LongRun + currentBuildup: same shape for multiple miles blocks of easy/Tempo

INTERVALS segmentPaceDist — choose ladder vs block repeat carefully:
- **Block repeat** (same schema as tempo but segments use meters): alternating steps that repeat together as ONE cycle — e.g. **rolling/cruise 400s** (fast 400 → float/recovery 400, no jog between steps; repeat 5–8×), Iglois, “continuous turnover”. One cycle lists every stride in order; **repeatCount** is how many times you run that full cycle back-to-back. Example rolling 400s:
  { "layout": "blockRepeat", "segments": [ { "distanceMeters": 400, "paceOffsetSecPerMile": -20 }, { "distanceMeters": 400, "paceOffsetSecPerMile": 48 } ], "repeatCount": 6 }
  Omit "recoveryBetweenCyclesSeconds" unless the text explicitly asks for timed rest BETWEEN whole repeats of the cycle.

- **Rep ladder** (flat array): use ONLY when repeats are **grouped by row**. The builder inserts recovery **after each work rep**. Set **recoveryDurationSeconds** for timed recovery (**seconds** — materialized as a TIME step; overrides distance when positive) **or recoveryDistanceMeters** for jog distance (**default 400 m** when both omit). Do **not** model alternating fast/float as two ladder rows × reps — use blockRepeat instead.

- Pyramid / varied-distance ladders with per-row reps: flat array shape as usual.

EASY / WARM / COOL
- "warmupMiles" | "cooldownMiles" | "warmupPaceOffsetSecPerMile" | "cooldownPaceOffsetSecPerMile" as needed

Pace sign: offsets are **seconds per mile vs the current 5K anchor**. After an at-sign (\`@\`), a **bare positive number** is the same as explicit plus: \`@ 5\` and \`@ +5\` both mean **+5 sec/mi** (slower / easier than anchor). \`@ -5\` means **−5 sec/mi** (faster / harder than anchor). Apply to reps, jogs, warmup, and cooldown lines consistently.

Output ONLY a single valid JSON object. No markdown.`;

export function normalizeCatalogueAiFields(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const f: Record<string, unknown> = { ...raw };
  if (f.segmentPaceDist == null && f.segmentPatternJson != null) {
    f.segmentPaceDist = f.segmentPatternJson;
  }
  if (f.segmentPaceDist == null && f.workSegmentsJson != null) {
    f.segmentPaceDist = f.workSegmentsJson;
  }
  delete f.segmentPatternJson;
  delete f.workSegmentsJson;
  if (f.workBaseReps == null && f.reps != null) f.workBaseReps = f.reps;
  if (f.workBaseRepMeters == null && f.repDistanceMeters != null) {
    f.workBaseRepMeters = f.repDistanceMeters;
  }
  if (f.workPaceOffsetSecPerMile == null && f.overallPaceOffsetSecPerMile != null) {
    f.workPaceOffsetSecPerMile = f.overallPaceOffsetSecPerMile;
  }
  if (f.workBasePaceOffsetSecPerMile == null && f.repPaceOffsetSecPerMile != null) {
    f.workBasePaceOffsetSecPerMile = f.repPaceOffsetSecPerMile;
  }
  if (f.recoveryDurationSeconds == null && f.recoveryBetweenRepsSeconds != null) {
    f.recoveryDurationSeconds = f.recoveryBetweenRepsSeconds;
  }
  const wt = typeof f.workoutType === "string" ? f.workoutType : "";
  if (wt === "SpeedDuration") {
    f.workoutType = "Tempo";
  }
  const wtNorm = typeof f.workoutType === "string" ? f.workoutType : "";
  if (wtNorm === "Tempo") {
    const reps = f.workBaseReps ?? f.reps;
    const repM = f.workBaseRepMeters ?? f.repDistanceMeters;
    const wbm = f.workBaseMiles;
    if (reps === 1 && wbm == null && typeof repM === "number" && repM > 1000) {
      const miles = repM / 1609.344;
      f.workBaseMiles = Math.round(miles * 100) / 100;
      f.workBaseReps = null;
      f.workBaseRepMeters = null;
    }
  }

  const purposeRaw = f.purpose;
  delete f.purpose;

  if (typeof purposeRaw === "string" && purposeRaw.trim()) {
    f.trainingIntent = normalizeTrainingIntentArray([purposeRaw.trim()]);
  }

  const ti = f.trainingIntent;
  if (ti != null && ti !== "") {
    if (Array.isArray(ti)) {
      const cleaned = normalizeTrainingIntentArray(ti.map(String));
      f.trainingIntent = cleaned.length ? cleaned : [];
    } else if (typeof ti === "string") {
      f.trainingIntent = parseTrainingIntentFromCell(ti);
    } else {
      delete f.trainingIntent;
    }
  } else {
    delete f.trainingIntent;
  }

  for (const k of [
    "reps",
    "repDistanceMeters",
    "isLadder",
    "isLadderCapable",
    "ladderStepMeters",
    "minLadderMeters",
    "maxLadderMeters",
    "progressionIndex",
    "intendedPhase",
    "repPaceOffsetSecPerMile",
    "overallPaceOffsetSecPerMile",
    "recoveryBetweenRepsSeconds",
  ] as const) {
    delete f[k];
  }

  const wtLr = typeof f.workoutType === "string" ? f.workoutType : "";
  const anch = typeof f.paceAnchor === "string" ? f.paceAnchor : "";
  if (wtLr === "LongRun" && anch === "mpSimulation") {
    f.mpFraction = null;
    f.mpTotalMiles = null;
    f.mpBlockPosition = null;
    f.mpBlockProgression = "flat";
    f.mpPaceOffsetSecPerMile = null;
    f.warmupFraction = null;
    f.workFraction = null;
    f.cooldownFraction = null;
    const wu = Number(f.warmupMiles);
    const cd = Number(f.cooldownMiles);
    if (!(Number.isFinite(wu) && wu >= 0)) f.warmupMiles = 2;
    if (!(Number.isFinite(cd) && cd >= 0)) f.cooldownMiles = 2;
  }

  return f;
}

function resolveCatalogueAiModel(): string {
  const explicitCatalogue = process.env.OPENAI_CATALOGUE_AI_MODEL?.trim();
  const globalModel = process.env.OPENAI_MODEL?.trim();
  const globalLower = (globalModel ?? "").toLowerCase();
  const globalIsReasoning =
    globalLower.startsWith("gpt-5") ||
    globalLower.startsWith("gpt-oss") ||
    globalLower.startsWith("o1") ||
    globalLower.startsWith("o3");

  return (
    explicitCatalogue ||
    (globalModel && !globalIsReasoning ? globalModel : "") ||
    "gpt-4o-mini"
  ).trim();
}

export async function parseCatalogueDescriptionWithAi(
  description: string,
  options?: { forceWorkoutType?: "Tempo" | "Intervals" }
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const sanitized = sanitizeCatalogueDescriptionInput(description);
  if (!sanitized) {
    throw new Error("description is required");
  }

  const modelId = resolveCatalogueAiModel();
  const lower = modelId.toLowerCase();
  const omitTemperature =
    lower.startsWith("gpt-5") ||
    lower.startsWith("gpt-oss") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3");

  const userContent =
    options?.forceWorkoutType != null
      ? `Force workoutType to "${options.forceWorkoutType}" for this athlete quality picker step.\n\n${sanitized}`
      : sanitized;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      ...(omitTemperature ? {} : { temperature: 0.2 }),
      ...(!omitTemperature ? { response_format: { type: "json_object" } } : {}),
      max_completion_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("parseCatalogueDescriptionWithAi OpenAI HTTP", res.status, errText.slice(0, 500));
    throw new Error("AI parse failed — try again or shorten the paste.");
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty OpenAI response");

  const jsonStr = extractFirstJsonObject(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error("Model response was not valid JSON — try again or shorten the paste.");
  }

  const fields = normalizeCatalogueAiFields(parsed);
  if (options?.forceWorkoutType) {
    fields.workoutType = options.forceWorkoutType;
  }

  return fields;
}
