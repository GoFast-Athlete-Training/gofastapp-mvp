import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildRaceInfoPackets,
  trainingWeekContextFromPlan,
} from "@/lib/races/race-info-packets";
import type {
  RaceInfoPacketAthleteContext,
  RaceInfoPacketRaceInput,
  RaceInfoPacketsResponse,
} from "@/lib/races/race-info-packet-types";

export async function loadRaceInfoPacketsForAthlete(
  raceRegistryId: string,
  athleteId: string
): Promise<RaceInfoPacketsResponse | null> {
  const race = await prisma.race_registry.findFirst({
    where: { id: raceRegistryId, isActive: true },
    include: {
      course_segments: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          name: true,
          mileMarker: true,
          description: true,
          runTip: true,
        },
      },
    },
  });

  if (!race) return null;

  const [signup, plan, goal] = await Promise.all([
    prisma.athlete_race_signups.findUnique({
      where: {
        athleteId_raceRegistryId: {
          athleteId,
          raceRegistryId,
        },
      },
    }),
    prisma.training_plans.findFirst({
      where: {
        athleteId,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        raceId: raceRegistryId,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        name: true,
        startDate: true,
        totalWeeks: true,
        planSchedule: true,
        goalRaceTime: true,
        race_registry: { select: { raceDate: true } },
      },
    }),
    prisma.athleteGoal.findFirst({
      where: {
        athleteId,
        raceRegistryId,
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      select: { goalTime: true },
    }),
  ]);

  const raceInput: RaceInfoPacketRaceInput = {
    id: race.id,
    name: race.name,
    slug: race.slug,
    raceDate: race.raceDate,
    startTime: race.startTime,
    distanceLabel: race.distanceLabel,
    summaryPhrase: race.summaryPhrase,
    description: race.description,
    registrationUrl: race.registrationUrl,
    registrationOpenNow: race.registrationOpenNow,
    registrationOpenDate: race.registrationOpenDate,
    registrationCloseDate: race.registrationCloseDate,
    registrationFee: race.registrationFee,
    courseSlug: race.courseSlug,
    courseMapUrl: race.courseMapUrl,
    packetPickupLocation: race.packetPickupLocation,
    packetPickupDate: race.packetPickupDate,
    packetPickupTime: race.packetPickupTime,
    packetPickupDescription: race.packetPickupDescription,
    spectatorInfo: race.spectatorInfo,
    logisticsInfo: race.logisticsInfo,
    gearDropInstructions: race.gearDropInstructions,
    courseSegments: race.course_segments,
  };

  const weekCtx = plan
    ? trainingWeekContextFromPlan({
        startDate: plan.startDate,
        totalWeeks: plan.totalWeeks,
        raceDate: plan.race_registry?.raceDate ?? race.raceDate,
        planSchedule: plan.planSchedule,
      })
    : { weekNumber: null, totalWeeks: null, hasActivePlan: false };

  const athleteContext: RaceInfoPacketAthleteContext = {
    isSignedUp: Boolean(signup),
    training: {
      hasActivePlan: weekCtx.hasActivePlan,
      planName: plan?.name ?? null,
      weekNumber: weekCtx.weekNumber,
      totalWeeks: weekCtx.totalWeeks,
      goalTime: goal?.goalTime?.trim() || plan?.goalRaceTime?.trim() || null,
    },
  };

  return buildRaceInfoPackets(raceInput, athleteContext);
}
