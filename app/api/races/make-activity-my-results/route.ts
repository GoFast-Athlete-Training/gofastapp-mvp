export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { saveRaceResultExtended } from "@/lib/race-result-service";

/**
 * POST — stamp athlete_activities row as the race result for its matched plan race.
 * Body: { activityId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { activityId?: string };
  const activityId = body.activityId?.trim();
  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const activity = await prisma.athlete_activities.findFirst({
    where: { id: activityId, athleteId: auth.athlete.id },
    select: {
      id: true,
      duration: true,
      garmin_detail_workout: {
        select: {
          planId: true,
          training_plans: {
            select: {
              id: true,
              athleteRaceId: true,
              lifecycleStatus: true,
            },
          },
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }
  if (activity.duration == null || activity.duration <= 0) {
    return NextResponse.json(
      { error: "This activity has no duration to use as a finish time" },
      { status: 400 }
    );
  }

  const plan = activity.garmin_detail_workout?.training_plans;
  const athleteRaceId = plan?.athleteRaceId?.trim() || null;
  if (!athleteRaceId) {
    return NextResponse.json(
      { error: "This activity is not linked to a race on your training plan" },
      { status: 400 }
    );
  }

  const athleteRace = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId: auth.athlete.id },
    select: { raceRegistryId: true },
  });
  if (!athleteRace) {
    return NextResponse.json({ error: "Race signup not found" }, { status: 404 });
  }

  const saved = await saveRaceResultExtended(auth.athlete.id, {
    raceRegistryId: athleteRace.raceRegistryId,
    athleteRaceId,
    garminActivityId: activity.id,
    officialFinishTime: null,
    chipTime: null,
    gunTime: null,
  });

  return NextResponse.json({
    success: true,
    result: {
      id: saved.result.id,
      officialFinishTime: saved.result.officialFinishTime,
    },
  });
}
