/**
 * Lazy AI coaching note shown as "Coach prescription" on workout detail.
 * Cached on workouts.prescriptionNarrative.
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
 * Called from GET workout when prescription missing. Idempotent via DB field.
 */
export async function maybeGeneratePrescriptionNarrative(params: {
  workoutId: string;
  athleteId: string;
}): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("maybeGeneratePrescriptionNarrative: OPENAI_API_KEY missing");
    return;
  }

  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: {
      prescriptionNarrative: true,
      workoutType: true,
      title: true,
      weekNumber: true,
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
  };

  const systemPrompt = `You are an encouraging running coach writing the **pre-workout** coaching note for an athlete viewing their upcoming session.

Output rules:
- Return ONLY plain text — no markdown, no JSON, no bullet lists prefixed with "-" if you must use sentences; prefer short paragraphs over lists.
- 2–4 sentences total unless the catalogue has complex structure (Intervals not used here often).
- Use the athlete's first name naturally if provided; omit if absent.
- Reference **week number** and **total weeks** when both are numbers (e.g. "Week 3 of your 24-week build").
- Explain what this workout is *for* at this phase (e.g. first long run = aerobic base / finding rhythm; not racing the watch).
- If workPaceOffsetSecPerMile is a number — describe it plainly (e.g. that many seconds per mile slower than their current 5K fitness) using the actual offset value in the JSON payload — do NOT invent offsets.
- If hasMarathonBlock is false — do NOT mention marathon pace, MP finishes, or hard fast finishes unless notes/trainingIntent clearly say otherwise.
- If hasMarathonBlock is true — you may briefly mention the marathon-pace segment as prescribed.
- Do not shame. Practical, warm tone.

If structuredSteps is non-empty and helps explain the workout, you may weave in one clause (e.g. warm / main piece) without repeating Garmin jargon.`;

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
