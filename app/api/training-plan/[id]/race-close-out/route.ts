export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { completeRacePlanCloseOut } from "@/lib/training/complete-race-plan-closeout";
import { computePlanBuildMiles } from "@/lib/training/race-plan-closeout";
import { getRaceResultByAthleteRaceId } from "@/lib/race-result-service";
import { promoteMatchedRaceWorkoutToResultIfNeeded } from "@/lib/training/promote-matched-race-workout-result";
import { prisma } from "@/lib/prisma";

/** GET — close-out snapshot (build miles, result if any). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;
  const plan = await prisma.training_plans.findFirst({
    where: { id, athleteId: auth.athlete.id },
    select: {
      id: true,
      name: true,
      athleteRaceId: true,
      athlete_race: { select: { id: true, name: true, raceDate: true, raceRegistryId: true } },
      race_registry: { select: { id: true, name: true, raceDate: true } },
    },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (plan.athleteRaceId) {
    await promoteMatchedRaceWorkoutToResultIfNeeded(auth.athlete.id, plan.athleteRaceId);
  }

  const buildMiles = await computePlanBuildMiles({
    planId: plan.id,
    athleteId: auth.athlete.id,
  });

  const athleteRaceId = plan.athleteRaceId;
  const result =
    athleteRaceId != null
      ? await getRaceResultByAthleteRaceId(auth.athlete.id, athleteRaceId)
      : null;

  const raceName =
    plan.athlete_race?.name?.trim() ||
    plan.race_registry?.name?.trim() ||
    plan.name;
  const raceDate =
    plan.athlete_race?.raceDate ?? plan.race_registry?.raceDate ?? null;
  const raceRegistryId =
    plan.athlete_race?.raceRegistryId ?? plan.race_registry?.id ?? null;

  return NextResponse.json({
    planId: plan.id,
    raceName,
    raceDate: raceDate?.toISOString() ?? null,
    raceRegistryId,
    buildMiles,
    result: result
      ? {
          id: result.id,
          officialFinishTime: result.officialFinishTime,
          reflection: result.reflection,
        }
      : null,
  });
}

/** POST — save reflection and archive plan. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reflection?: string | null };

  const outcome = await completeRacePlanCloseOut({
    athleteId: auth.athlete.id,
    planId: id,
    reflection: body.reflection ?? null,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
