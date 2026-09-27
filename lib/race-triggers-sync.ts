/**
 * Keep race_triggers fresh from race_registry + athlete_races claims.
 */

import { prisma } from "@/lib/prisma";
import { addDaysUtc, utcDateOnly } from "@/lib/training/plan-utils";

function anchorFromRaceDate(raceDate: Date) {
  const raceDay = utcDateOnly(raceDate);
  return {
    raceDate: raceDay,
    weekOutDate: addDaysUtc(raceDay, -7),
    reminderDate: addDaysUtc(raceDay, -1),
  };
}

/** Upsert trigger row dates from catalog race day (UTC calendar). */
export async function syncRaceTriggerForRegistry(raceRegistryId: string) {
  const registry = await prisma.race_registry.findUnique({
    where: { id: raceRegistryId },
    select: { raceDate: true },
  });
  if (!registry) return null;

  const dates = anchorFromRaceDate(registry.raceDate);
  const now = new Date();

  const trigger = await prisma.race_triggers.upsert({
    where: { raceRegistryId },
    create: {
      raceRegistryId,
      ...dates,
      updatedAt: now,
    },
    update: {
      ...dates,
      updatedAt: now,
    },
  });

  await prisma.athlete_races.updateMany({
    where: { raceRegistryId },
    data: {
      raceWeekOutNotifiedAt: null,
      raceDayBeforeNotifiedAt: null,
      raceDayNotifiedAt: null,
    },
  });

  return trigger;
}

/** Register athlete on trigger ledger after claim (idempotent). */
export async function syncRaceTriggerMemberForAthleteRace(athleteRaceId: string) {
  const row = await prisma.athlete_races.findUnique({
    where: { id: athleteRaceId },
    select: {
      id: true,
      athleteId: true,
      raceRegistryId: true,
      notifyEnabled: true,
    },
  });
  if (!row) return;

  const trigger =
    (await syncRaceTriggerForRegistry(row.raceRegistryId)) ??
    (await prisma.race_triggers.findUnique({
      where: { raceRegistryId: row.raceRegistryId },
    }));
  if (!trigger) return;

  const now = new Date();
  await prisma.race_trigger_athletes.upsert({
    where: { athleteRaceId: row.id },
    create: {
      raceTriggerId: trigger.id,
      athleteId: row.athleteId,
      athleteRaceId: row.id,
      notifyEnabled: row.notifyEnabled,
      updatedAt: now,
    },
    update: {
      notifyEnabled: row.notifyEnabled,
      updatedAt: now,
    },
  });
}

export async function removeRaceTriggerMember(athleteRaceId: string) {
  await prisma.race_trigger_athletes.deleteMany({
    where: { athleteRaceId },
  });
}

/** Backfill triggers for all claimed races (cron safety / deploy). */
export async function ensureRaceTriggersForAllClaims() {
  const registryIds = await prisma.athlete_races.findMany({
    distinct: ["raceRegistryId"],
    select: { raceRegistryId: true },
  });
  for (const { raceRegistryId } of registryIds) {
    await syncRaceTriggerForRegistry(raceRegistryId);
  }
  const rows = await prisma.athlete_races.findMany({ select: { id: true } });
  for (const { id } of rows) {
    await syncRaceTriggerMemberForAthleteRace(id);
  }
}
