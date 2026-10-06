import { prisma } from "@/lib/prisma";
import { archiveTrainingPlan } from "@/lib/training/plan-lifecycle";
import { promoteMatchedRaceWorkoutToResultIfNeeded } from "@/lib/training/promote-matched-race-workout-result";
import {
  getRaceResultByAthleteRaceId,
  updateRaceResultReflection,
} from "@/lib/race-result-service";

export async function completeRacePlanCloseOut(params: {
  athleteId: string;
  planId: string;
  reflection?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { id: true, athleteRaceId: true },
  });
  if (!plan) {
    return { ok: false, error: "Plan not found" };
  }
  if (!plan.athleteRaceId) {
    return { ok: false, error: "Plan has no linked race" };
  }

  const promoted = await promoteMatchedRaceWorkoutToResultIfNeeded(
    params.athleteId,
    plan.athleteRaceId
  );

  let result = await getRaceResultByAthleteRaceId(params.athleteId, plan.athleteRaceId);
  if (!result?.officialFinishTime?.trim() && !promoted.promoted) {
    return {
      ok: false,
      error:
        "Link your race activity first — open Activity and use Make these my results, or find your race-day run.",
    };
  }

  const reflection = params.reflection?.trim() || null;
  if (reflection) {
    result = await getRaceResultByAthleteRaceId(params.athleteId, plan.athleteRaceId);
    if (result?.id) {
      await updateRaceResultReflection(params.athleteId, result.id, { reflection });
    }
  }

  await archiveTrainingPlan(params.athleteId, plan.id);
  return { ok: true };
}
