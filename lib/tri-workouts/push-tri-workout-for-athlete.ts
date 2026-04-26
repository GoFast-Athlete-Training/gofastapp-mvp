import { prisma } from "@/lib/prisma";
import { TriSport } from "@prisma/client";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { pushBikeWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-bike-workout-for-athlete";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";

function utcTodayYmd(): string {
  return ymdFromDate(new Date());
}

export type PushTriWorkoutLegResult = {
  legId: string;
  sport: TriSport;
  ok: boolean;
  code?: string;
  message?: string;
  garminWorkoutId?: number;
  garminScheduleId?: number;
};

export type PushTriWorkoutForAthleteResult =
  | {
      ok: true;
      scheduledDate: string;
      legs: PushTriWorkoutLegResult[];
    }
  | {
      ok: false;
      code: "not_found" | "no_legs" | "other";
      message: string;
      legs?: PushTriWorkoutLegResult[];
    };

/**
 * Push each leg of a tri_workout to Garmin on the same calendar day (session date or today).
 */
export async function pushTriWorkoutToGarminForAthlete(
  athleteId: string,
  triWorkoutId: string
): Promise<PushTriWorkoutForAthleteResult> {
  const tri = await prisma.tri_workout.findFirst({
    where: { id: triWorkoutId, athleteId },
    include: {
      legs: { orderBy: { legOrder: "asc" } },
    },
  });

  if (!tri) {
    return { ok: false, code: "not_found", message: "Tri workout not found" };
  }

  if (!tri.legs.length) {
    return { ok: false, code: "no_legs", message: "Tri workout has no legs" };
  }

  const scheduledDate = tri.date ? ymdFromDate(tri.date) : utcTodayYmd();
  const legs: PushTriWorkoutLegResult[] = [];

  for (const leg of tri.legs) {
    if (leg.sport === TriSport.Bike) {
      if (!leg.bikeWorkoutId) {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: false,
          code: "missing_bike",
          message: "Bike leg has no bikeWorkoutId",
        });
        continue;
      }
      const r = await pushBikeWorkoutToGarminForAthlete(
        athleteId,
        leg.bikeWorkoutId,
        scheduledDate
      );
      if (r.ok) {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: true,
          garminWorkoutId: r.garminWorkoutId,
          garminScheduleId: r.garminScheduleId,
        });
      } else {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: false,
          code: r.code,
          message: r.message,
        });
      }
      continue;
    }

    if (leg.sport === TriSport.Run) {
      if (!leg.runWorkoutId) {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: false,
          code: "missing_run",
          message: "Run leg has no runWorkoutId",
        });
        continue;
      }
      const r = await pushWorkoutToGarminForAthlete(
        athleteId,
        leg.runWorkoutId,
        scheduledDate
      );
      if (r.ok) {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: true,
          garminWorkoutId: r.garminWorkoutId,
          garminScheduleId: r.garminScheduleId,
        });
      } else {
        legs.push({
          legId: leg.id,
          sport: leg.sport,
          ok: false,
          code: r.code,
          message: r.message,
        });
      }
      continue;
    }

    legs.push({
      legId: leg.id,
      sport: leg.sport,
      ok: false,
      code: "swim_not_supported",
      message: "Swim leg Garmin push is not implemented yet",
    });
  }

  const allOk = legs.every((l) => l.ok);
  if (!allOk) {
    return {
      ok: false,
      code: "other",
      message: "One or more legs failed to push to Garmin",
      legs,
    };
  }

  return { ok: true, scheduledDate, legs };
}
