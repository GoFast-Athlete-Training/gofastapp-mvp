/**
 * Tactical pre-workout coach guidance persisted on workouts.prescriptionNarrative.
 * One OpenAI call per workout row (idempotent); triggered at materialization with GET fallback.
 */

import { prisma } from "@/lib/prisma";
import type { WorkoutType } from "@prisma/client";

const SKIP_TYPES: ReadonlySet<WorkoutType> = new Set(["Intervals", "Tempo"]);

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/**
 * Ensures workouts.prescriptionNarrative exists for catalogue-backed workouts.
 * No-op when already set, missing catalogue, or skipped workout types.
 */
export async function ensureWorkoutPrescriptionNarrative(params: {
  workoutId: string;
  athleteId: string;
}): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("ensureWorkoutPrescriptionNarrative: OPENAI_API_KEY missing");
    return;
  }

  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: {
      prescriptionNarrative: true,
      workoutType: true,
      title: true,
      weekNumber: true,
      dayAssigned: true,
      date: true,
      estimatedDistanceInMeters: true,
      targetPaceSecPerMile: true,
      targetPaceSecPerMileHigh: true,
      catalogueWorkoutId: true,
      workout_catalogue: {
        select: {
          name: true,
          slug: true,
          notes: true,
          trainingIntent: true,
          workoutType: true,
          paceAnchor: true,
          mpFraction: true,
          mpTotalMiles: true,
          workPaceOffsetSecPerMile: true,
          recoveryPaceOffsetSecPerMile: true,
          workBaseReps: true,
          workBaseRepMeters: true,
        },
      },
      training_plans: {
        select: {
          name: true,
          totalWeeks: true,
          currentFiveKPace: true,
          planSchedule: true,
        },
      },
      segments: {
        orderBy: { stepOrder: "asc" },
        select: {
          title: true,
          durationType: true,
          durationValue: true,
        },
      },
    },
  });

  if (!workout?.workout_catalogue?.name || SKIP_TYPES.has(workout.workoutType)) {
    return;
  }
  if (workout.prescriptionNarrative?.trim()) {
    return;
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: {
      firstName: true,
      fiveKPace: true,
    },
  });
  if (!athlete) return;

  const cat = workout.workout_catalogue;
  const anchorPaceDisplay =
    workout.training_plans?.currentFiveKPace?.trim() || athlete.fiveKPace?.trim() || null;

  const paceTargetLine =
    workout.targetPaceSecPerMile != null &&
    workout.targetPaceSecPerMileHigh != null &&
    workout.targetPaceSecPerMileHigh !== workout.targetPaceSecPerMile
      ? `Target pace band (sec/mi low–high): ${workout.targetPaceSecPerMile}–${workout.targetPaceSecPerMileHigh}`
      : workout.targetPaceSecPerMile != null
        ? `Target pace (approx sec/mi): ${workout.targetPaceSecPerMile}`
        : null;

  const catalogueContext = {
    name: cat.name,
    slug: cat.slug,
    catalogueWorkoutType: cat.workoutType,
    paceAnchor: cat.paceAnchor,
    workPaceOffsetSecPerMile: cat.workPaceOffsetSecPerMile,
    recoveryPaceOffsetSecPerMile: cat.recoveryPaceOffsetSecPerMile,
    hasMarathonBlock:
      cat.mpFraction != null && Number(cat.mpFraction) > 0
        ? true
        : cat.mpTotalMiles != null && Number(cat.mpTotalMiles) > 0,
    notes: cat.notes,
    trainingIntent: cat.trainingIntent,
  };

  const payload = {
    athlete: {
      firstName: athlete.firstName,
      baseline5KDisplayed: anchorPaceDisplay,
    },
    workout: {
      title: workout.title,
      workoutType: workout.workoutType,
      weekNumber: workout.weekNumber,
      dayAssigned: workout.dayAssigned,
      scheduledDate: workout.date,
      planName: workout.training_plans?.name ?? null,
      planTotalWeeks: workout.training_plans?.totalWeeks ?? null,
      scheduledDistanceMeters: workout.estimatedDistanceInMeters,
      structuredSteps: workout.segments.map((s) => ({
        title: s.title,
        durationType: s.durationType,
        durationValue: s.durationValue,
      })),
    },
    catalogue: catalogueContext,
    paceTargetLine,
    planSchedule: workout.training_plans?.planSchedule ?? null,
  };

  const systemPrompt = `You are an encouraging running coach writing **Coach Guidance** for an athlete's upcoming session — tactical, week-aware, and actionable.

Output rules:
- Return ONLY plain text — no markdown, no JSON, no bullet lists.
- Exactly 2–3 sentences. Each sentence should help the athlete execute and succeed today.
- Use the athlete's first name naturally if provided; omit if absent.
- When weekNumber and planTotalWeeks are numbers, anchor placement (e.g. "Week 3 of your 24-week build").
- When dayAssigned is present, reference the day of week naturally if it helps framing.
- Use catalogue.trainingIntent and notes as the "why" — your job is the "how to run it today."
- Be specific when you can infer context: first quality session of the week, easy day tomorrow, save legs for the long run, commit on the last rep/push — only when supported by workout type, week, day, or structuredSteps. Do not invent schedule facts not in the payload.
- If workPaceOffsetSecPerMile is a number, describe it plainly using the actual value — do NOT invent offsets.
- If hasMarathonBlock is false — do NOT mention marathon pace or hard fast finishes unless notes/trainingIntent clearly say otherwise.
- If hasMarathonBlock is true — you may briefly mention the marathon-pace segment as prescribed.
- Practical, warm, direct tone — "do this and succeed," not generic filler.

If structuredSteps is non-empty, weave in one concrete execution cue (warmup discipline, where to push, what to hold back) without Garmin jargon.`;

  let content = "";
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
          { role: "user", content: JSON.stringify(payload, null, 2) },
        ],
        temperature: 0.45,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("prescription narrative OpenAI HTTP", res.status, errText.slice(0, 500));
      return;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = (data.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    console.error("prescription narrative fetch:", e);
    return;
  }

  const narrative = truncate(content.replace(/\*\*/g, ""), 2000);
  if (!narrative) return;

  await prisma.workouts.updateMany({
    where: {
      id: params.workoutId,
      athleteId: params.athleteId,
      prescriptionNarrative: null,
    },
    data: { prescriptionNarrative: narrative, updatedAt: new Date() },
  });
}
