/**
 * Client helpers — point plan at a new race or cruise with overlay, then regenerate.
 */

import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

const DISMISS_PREFIX = "gofast-dismiss-added-race:";

export type PlanRaceEventsPayload = {
  candidates: Array<{
    athleteRaceId: string;
    raceRegistryId: string;
    race: {
      name: string;
      raceDate: string;
      distanceLabel: string | null;
    };
  }>;
  snappedAthleteRaceIds: string[];
  pendingCandidates: Array<{
    athleteRaceId: string;
    raceRegistryId: string;
    race: {
      name: string;
      raceDate: string;
      distanceLabel: string | null;
    };
  }>;
  needsRegenerate: boolean;
  terminalRace?: {
    athleteRaceId: string;
    name: string;
  } | null;
  focusWeekNumber?: number | null;
};

export function dismissAddedRacePrompt(athleteRaceId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${DISMISS_PREFIX}${athleteRaceId}`, "1");
}

export function isAddedRacePromptDismissed(athleteRaceId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(`${DISMISS_PREFIX}${athleteRaceId}`) === "1";
}

export async function fetchPlanRaceEvents(
  planId: string,
  token: string,
  opts?: { focusAthleteRaceId?: string }
): Promise<PlanRaceEventsPayload | null> {
  const qs = opts?.focusAthleteRaceId
    ? `?focusAthleteRaceId=${encodeURIComponent(opts.focusAthleteRaceId)}`
    : "";
  const res = await fetch(`/api/training-plan/${encodeURIComponent(planId)}/race-events${qs}`, {
    headers: athleteBearerFetchHeaders(token),
  });
  if (!res.ok) return null;
  return (await res.json()) as PlanRaceEventsPayload;
}

export async function patchPlanAthleteRaceId(
  planId: string,
  token: string,
  athleteRaceId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/training-plan/${encodeURIComponent(planId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...athleteBearerFetchHeaders(token),
    },
    body: JSON.stringify({ athleteRaceId }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Could not update plan goal race" };
  }
  return { ok: true };
}

export async function regeneratePlanWithSecondaries(
  planId: string,
  token: string,
  params: {
    weeklyMileageTarget: number;
    minWeeklyMiles?: number;
    includedSecondaryAthleteRaceIds: string[];
  }
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/training/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...athleteBearerFetchHeaders(token),
    },
    body: JSON.stringify({
      trainingPlanId: planId,
      weeklyMileageTarget: params.weeklyMileageTarget,
      minWeeklyMiles: params.minWeeklyMiles,
      includedSecondaryAthleteRaceIds: params.includedSecondaryAthleteRaceIds,
      includedSecondarySignupIds: params.includedSecondaryAthleteRaceIds,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Regeneration failed" };
  }
  return { ok: true };
}

export async function pointPlanHereAndRegenerate(params: {
  planId: string;
  token: string;
  newAthleteRaceId: string;
  weeklyMileageTarget: number;
  minWeeklyMiles?: number;
  snappedAthleteRaceIds: string[];
  pendingAthleteRaceIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const patched = await patchPlanAthleteRaceId(
    params.planId,
    params.token,
    params.newAthleteRaceId
  );
  if (!patched.ok) return patched;

  const secondaryIds = [
    ...new Set([
      ...params.snappedAthleteRaceIds,
      ...params.pendingAthleteRaceIds.filter((id) => id !== params.newAthleteRaceId),
    ]),
  ];

  return regeneratePlanWithSecondaries(params.planId, params.token, {
    weeklyMileageTarget: params.weeklyMileageTarget,
    minWeeklyMiles: params.minWeeklyMiles,
    includedSecondaryAthleteRaceIds: secondaryIds,
  });
}

export async function cruiseOverlayAndRegenerate(params: {
  planId: string;
  token: string;
  weeklyMileageTarget: number;
  minWeeklyMiles?: number;
  snappedAthleteRaceIds: string[];
  pendingAthleteRaceIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const secondaryIds = [
    ...new Set([...params.snappedAthleteRaceIds, ...params.pendingAthleteRaceIds]),
  ];
  return regeneratePlanWithSecondaries(params.planId, params.token, {
    weeklyMileageTarget: params.weeklyMileageTarget,
    minWeeklyMiles: params.minWeeklyMiles,
    includedSecondaryAthleteRaceIds: secondaryIds,
  });
}
