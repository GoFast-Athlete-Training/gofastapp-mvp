export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ymdFromDate } from "@/lib/training/plan-utils";

/**
 * GET /api/me/past-races
 * Returns the athlete's logged race results, newest first, joined to race registry.
 * Intended for athlete profile / goals page. No plan data included — use
 * GET /api/training-plan/archived for plan + result combined view.
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const results = await prisma.athlete_race_results.findMany({
      where: { athleteId: athlete.id },
      orderBy: [{ raceDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        officialFinishTime: true,
        chipTime: true,
        finishTimeSeconds: true,
        goalTimeSeconds: true,
        goalTimeDeltaSeconds: true,
        goalAchieved: true,
        prAchieved: true,
        raceDate: true,
        distanceLabel: true,
        reflection: true,
        howFeltRating: true,
        overallPlace: true,
        ageGroupPlace: true,
        source: true,
        race_registry: {
          select: {
            id: true,
            name: true,
            raceDate: true,
            distanceLabel: true,
          },
        },
      },
    });

    const serialized = results.map((r) => ({
      id: r.id,
      officialFinishTime: r.officialFinishTime,
      chipTime: r.chipTime,
      finishTimeSeconds: r.finishTimeSeconds,
      goalTimeSeconds: r.goalTimeSeconds,
      goalTimeDeltaSeconds: r.goalTimeDeltaSeconds,
      goalAchieved: r.goalAchieved,
      prAchieved: r.prAchieved,
      raceDate: r.raceDate ? ymdFromDate(r.raceDate) : null,
      distanceLabel: r.distanceLabel,
      reflection: r.reflection,
      howFeltRating: r.howFeltRating,
      overallPlace: r.overallPlace,
      ageGroupPlace: r.ageGroupPlace,
      source: r.source,
      race: r.race_registry
        ? {
            id: r.race_registry.id,
            name: r.race_registry.name,
            raceDate: ymdFromDate(r.race_registry.raceDate),
            distanceLabel: r.race_registry.distanceLabel,
          }
        : null,
    }));

    return NextResponse.json({ success: true, results: serialized });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load past races";
    console.error("GET /api/me/past-races", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
