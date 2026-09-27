import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { processRaceReminders } from "@/lib/race-reminders";
import {
  syncRaceTriggerForRegistry,
  syncRaceTriggerMemberForAthleteRace,
} from "@/lib/race-triggers-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/cron/race-reminders — week-out, day-before, and race-day nudges (UTC calendar). */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const distinct = await prisma.athlete_races.findMany({
      distinct: ["raceRegistryId"],
      select: { raceRegistryId: true },
    });
    for (const { raceRegistryId } of distinct) {
      const exists = await prisma.race_triggers.findUnique({
        where: { raceRegistryId },
        select: { id: true },
      });
      if (!exists) {
        await syncRaceTriggerForRegistry(raceRegistryId);
      }
    }

    const missingMembers = await prisma.athlete_races.findMany({
      where: { race_trigger_member: null },
      select: { id: true },
      take: 500,
    });
    for (const { id } of missingMembers) {
      await syncRaceTriggerMemberForAthleteRace(id);
    }

    const out = await processRaceReminders(new Date());
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("race-reminders cron:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
