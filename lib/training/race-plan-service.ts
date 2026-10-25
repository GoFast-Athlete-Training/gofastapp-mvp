import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeRacePlanDocument,
  validateRacePlanDocument,
} from "@/lib/races/race-plan-builder";
import { EMPTY_RACE_PLAN, type RacePlanDocument } from "@/lib/races/race-plan-types";
import {
  calendarDayWritePair,
  normalizeDateKeyInput,
  resolveRaceDayKey,
} from "@/lib/plan-calendar-day";

export class RacePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RacePlanError";
  }
}

function parseRaceDayAndAnchor(raw: Date | string, fallback?: { raceDate: Date; raceDay?: string | null }) {
  const key =
    raw instanceof Date
      ? resolveRaceDayKey({ raceDate: raw, raceDay: null })
      : normalizeDateKeyInput(String(raw)) ??
        (fallback ? resolveRaceDayKey(fallback) : null);
  if (!key) throw new RacePlanError("Invalid race date");
  return { raceDay: key, raceDate: calendarDayWritePair(key).anchor };
}

export async function getRacePlanForAthleteRace(params: {
  athleteId: string;
  athleteRaceId: string;
}): Promise<{
  racePlanId: string | null;
  title: string | null;
  planJson: RacePlanDocument;
  pushedAt: Date | null;
}> {
  const row = await prisma.race_plans.findFirst({
    where: { athleteId: params.athleteId, athleteRaceId: params.athleteRaceId },
    select: { id: true, title: true, planJson: true, pushedAt: true },
  });
  if (!row) {
    return { racePlanId: null, title: null, planJson: { ...EMPTY_RACE_PLAN }, pushedAt: null };
  }
  return {
    racePlanId: row.id,
    title: row.title?.trim() || null,
    planJson: normalizeRacePlanDocument(row.planJson),
    pushedAt: row.pushedAt,
  };
}

export async function upsertRacePlan(params: {
  athleteId: string;
  athleteRaceId: string;
  planId?: string | null;
  title: string;
  raceDate: Date | string;
  planJson: RacePlanDocument;
}): Promise<{ racePlanId: string }> {
  const title = params.title?.trim();
  if (!title) throw new RacePlanError("Title is required");

  const athleteRace = await prisma.athlete_races.findFirst({
    where: { id: params.athleteRaceId, athleteId: params.athleteId },
    select: { id: true, raceDate: true, raceDay: true },
  });
  if (!athleteRace) throw new RacePlanError("Race signup not found");

  const doc = normalizeRacePlanDocument(params.planJson);
  validateRacePlanDocument(doc);

  const { raceDate, raceDay } = parseRaceDayAndAnchor(
    params.raceDate ?? athleteRace.raceDate,
    athleteRace
  );
  const planId = params.planId?.trim() || null;

  const existing = await prisma.race_plans.findUnique({
    where: { athleteRaceId: params.athleteRaceId },
    select: { id: true },
  });

  const planJson = doc as unknown as Prisma.InputJsonValue;

  if (existing) {
    await prisma.race_plans.update({
      where: { id: existing.id },
      data: {
        title,
        planId,
        raceDate,
        raceDay,
        planJson,
        updatedAt: new Date(),
      },
    });
    return { racePlanId: existing.id };
  }

  const created = await prisma.race_plans.create({
    data: {
      athleteId: params.athleteId,
      athleteRaceId: params.athleteRaceId,
      planId,
      raceDate,
      raceDay,
      title,
      planJson,
      updatedAt: new Date(),
    },
    select: { id: true },
  });
  return { racePlanId: created.id };
}
