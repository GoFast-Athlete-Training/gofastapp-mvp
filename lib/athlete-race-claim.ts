/**
 * Canonical catalog → athlete_races claim with side effects.
 * POST { raceRegistryId } is idempotent via athleteId + raceRegistryId uniqueness.
 */

import { prisma } from "@/lib/prisma";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import {
  claimAthleteRace,
  deleteAthleteRace,
  getAthleteRaceForAthlete,
  listAthleteRaces,
  type SerializedAthleteRace,
} from "@/lib/athlete-races-service";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import {
  athleteRaceAffectsActivePlan,
  findActivePlanForAthlete,
  previewPlanRaceCollision,
} from "@/lib/training/race-plan-calendar-service";

export type AthleteRacePlanImpact = Awaited<ReturnType<typeof athleteRaceAffectsActivePlan>>;
export type AthleteRaceImpactPreview = ReturnType<typeof previewPlanRaceCollision> | null;

export type AthleteRaceClaimResult = {
  athleteRace: SerializedAthleteRace;
  planImpact: AthleteRacePlanImpact;
  impactPreview: AthleteRaceImpactPreview;
};

export function serializeAthleteRaceClaimResponse(result: AthleteRaceClaimResult) {
  const { athleteRace, planImpact, impactPreview } = result;
  return {
    athleteRace,
    planImpact,
    impactPreview,
    /** @deprecated compatibility alias — use athleteRace */
    signup: athleteRace,
  };
}

export function isRaceNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message === "Race not found";
}

/** Idempotent claim: upsert athlete_races, hub membership, profile snapshot, plan preview. */
export async function claimAthleteRaceWithSideEffects(params: {
  athleteId: string;
  raceRegistryId: string;
}): Promise<AthleteRaceClaimResult> {
  const athleteRace = await claimAthleteRace(params);

  await upsertRaceMembershipFromSignup(params.athleteId, params.raceRegistryId);
  await syncAthleteProfileSnapshot(params.athleteId);

  const planImpact = await athleteRaceAffectsActivePlan({
    athleteId: params.athleteId,
    athleteRaceId: athleteRace.id,
    raceDate: athleteRace.raceDate,
  });

  let impactPreview: AthleteRaceImpactPreview = null;
  if (planImpact.affectsPlan && planImpact.planId) {
    const activePlan = await findActivePlanForAthlete(params.athleteId);
    if (activePlan?.planSchedule) {
      impactPreview = previewPlanRaceCollision({
        planId: planImpact.planId,
        planStart: activePlan.startDate,
        totalWeeks: activePlan.totalWeeks,
        planSchedule: activePlan.planSchedule,
        entry: {
          athleteRaceId: athleteRace.id,
          raceRegistryId: athleteRace.raceRegistryId,
          raceName: athleteRace.name,
          raceDate: athleteRace.raceDate,
          distanceMeters: athleteRace.distanceMeters,
        },
      });
    }
  }

  return { athleteRace, planImpact, impactPreview };
}

export async function listAthleteRacesForAthlete(athleteId: string) {
  return listAthleteRaces(athleteId);
}

export async function getAthleteRaceById(params: {
  athleteId: string;
  athleteRaceId: string;
}) {
  return getAthleteRaceForAthlete(params.athleteId, params.athleteRaceId);
}

/** Remove athlete race and race-hub membership. */
export async function removeAthleteRaceWithSideEffects(params: {
  athleteId: string;
  athleteRaceId: string;
}): Promise<boolean> {
  const existing = await getAthleteRaceForAthlete(params.athleteId, params.athleteRaceId);
  if (!existing) return false;

  const deleted = await deleteAthleteRace(params);
  if (!deleted) return false;

  await prisma.race_memberships.deleteMany({
    where: {
      athleteId: params.athleteId,
      raceId: existing.raceRegistryId,
      role: "MEMBER",
    },
  });

  return true;
}
