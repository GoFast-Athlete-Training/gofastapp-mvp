import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeRacePlanDocument,
  validateRacePlanDocument,
} from "@/lib/races/race-plan-builder";
import { EMPTY_RACE_PLAN, type RacePlanDocument } from "@/lib/races/race-plan-types";
import { utcDateOnly } from "@/lib/training/plan-utils";

export class RacePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RacePlanError";
  }
}

function parseRaceDate(raw: Date | string): Date {
  if (raw instanceof Date) return utcDateOnly(raw);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return new Date(`${s.slice(0, 10)}T12:00:00.000Z`);
  }
  return utcDateOnly(new Date(s));
}

export async function getRacePlanForAthleteRace(params: {
  athleteId: string;
  athleteRaceId: string;
}): Promise<{ racePlanId: string | null; planJson: RacePlanDocument; pushedAt: Date | null }> {
  const row = await prisma.race_plans.findFirst({
    where: { athleteId: params.athleteId, athleteRaceId: params.athleteRaceId },
    select: { id: true, planJson: true, pushedAt: true },
  });
  if (!row) {
    return { racePlanId: null, planJson: { ...EMPTY_RACE_PLAN }, pushedAt: null };
  }
  return {
    racePlanId: row.id,
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
    select: { id: true, raceDate: true },
  });
  if (!athleteRace) throw new RacePlanError("Race signup not found");

  const doc = normalizeRacePlanDocument(params.planJson);
  validateRacePlanDocument(doc);

  const raceDate = parseRaceDate(params.raceDate ?? athleteRace.raceDate);
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
      title,
      planJson,
      updatedAt: new Date(),
    },
    select: { id: true },
  });
  return { racePlanId: created.id };
}
