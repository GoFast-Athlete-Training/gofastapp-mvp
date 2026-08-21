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
import { cleanupPlanWorkoutsBeforeDelete } from "@/lib/training/plan-delete-cleanup";
import { TrainingPlanLifecycle } from "@prisma/client";

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

/** Remove athlete race and race-hub membership. Optionally delete active plan targeting this race first. */
export async function removeAthleteRaceWithSideEffects(params: {
  athleteId: string;
  athleteRaceId: string;
  deleteActivePlanIfTargeted?: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "active_plan_requires_confirmation"; trainingPlanId: string }
> {
  const existing = await getAthleteRaceForAthlete(params.athleteId, params.athleteRaceId);
  if (!existing) return { ok: false, reason: "not_found" };

  const activePlan = await prisma.training_plans.findFirst({
    where: {
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      athleteRaceId: params.athleteRaceId,
    },
    select: { id: true },
  });

  if (activePlan && !params.deleteActivePlanIfTargeted) {
    return {
      ok: false,
      reason: "active_plan_requires_confirmation",
      trainingPlanId: activePlan.id,
    };
  }

  if (activePlan && params.deleteActivePlanIfTargeted) {
    await cleanupPlanWorkoutsBeforeDelete({
      planId: activePlan.id,
      athleteId: params.athleteId,
    });
    await prisma.training_plans.delete({ where: { id: activePlan.id } });
  }

  const deleted = await deleteAthleteRace(params);
  if (!deleted) return { ok: false, reason: "not_found" };

  await prisma.race_memberships.deleteMany({
    where: {
      athleteId: params.athleteId,
      raceId: existing.raceRegistryId,
      role: "MEMBER",
    },
  });

  return { ok: true };
}
