/**
 * @deprecated Plan race events table demoted — use race-plan-calendar-service + planSchedule JSON.
 * Thin re-exports for API compatibility.
 */

export type PlanRaceEventRow = {
  id: string;
  trainingPlanId: string;
  raceRegistryId: string;
  athleteRaceId: string | null;
  role: import("@prisma/client").TrainingPlanRaceEventRole;
  source: import("@prisma/client").TrainingPlanRaceEventSource;
  inclusion: import("@prisma/client").TrainingPlanRaceEventInclusion;
  raceName: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
};

export {
  listSecondaryCandidatesForPlan,
  findActivePlanForAthlete,
  athleteRaceAffectsActivePlan as signupAffectsActivePlan,
  resolvePlanRaceCalendar,
} from "@/lib/training/race-plan-calendar-service";

export type { HydratedRaceCalendarSignup } from "@/lib/training/race-calendar-hydrate";

/** No-op — JSON imprint is canonical; kept for API route compatibility. */
export async function syncPlanRaceEventsFromCalendar(_params: {
  trainingPlanId: string;
  athleteId: string;
  includedSecondaryAthleteRaceIds?: string[] | null;
  /** @deprecated use includedSecondaryAthleteRaceIds */
  includedSecondarySignupIds?: string[] | null;
}): Promise<PlanRaceEventRow[]> {
  return [];
}

export async function loadPlanRaceEvents(_trainingPlanId: string): Promise<PlanRaceEventRow[]> {
  return [];
}

export async function loadIncludedPlanRaceEventsForGeneration(_trainingPlanId: string): Promise<{
  primary: PlanRaceEventRow | null;
  secondary: PlanRaceEventRow[];
}> {
  return { primary: null, secondary: [] };
}
