import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

export type RegeneratePlanScheduleParams = {
  token: string;
  trainingPlanId: string;
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  includedSecondaryAthleteRaceIds?: string[];
};

export type RegeneratePlanScheduleResult =
  | { ok: true }
  | { ok: false; error: string };

/** Re-run plan generate from saved plan preferences (same POST as training setup). */
export async function postRegenerateTrainingPlanSchedule(
  params: RegeneratePlanScheduleParams
): Promise<RegeneratePlanScheduleResult> {
  const genRes = await fetch("/api/training/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...athleteBearerFetchHeaders(params.token),
    },
    body: JSON.stringify({
      trainingPlanId: params.trainingPlanId,
      weeklyMileageTarget: params.weeklyMileageTarget,
      minWeeklyMiles: params.minWeeklyMiles,
      ...(params.includedSecondaryAthleteRaceIds?.length
        ? {
            includedSecondaryAthleteRaceIds: params.includedSecondaryAthleteRaceIds,
            includedSecondarySignupIds: params.includedSecondaryAthleteRaceIds,
          }
        : {}),
    }),
  });
  const genData = (await genRes.json()) as { error?: string };
  if (!genRes.ok) {
    return { ok: false, error: genData.error ?? "Regeneration failed" };
  }
  return { ok: true };
}
