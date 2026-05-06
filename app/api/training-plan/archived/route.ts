export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";

/**
 * GET /api/training-plan/archived
 * Returns the athlete's archived training plans, newest first.
 * Each plan includes its linked race and, when available, the athlete's race result
 * for that race (joined via athlete_race_results.raceRegistryId).
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const plans = await prisma.training_plans.findMany({
      where: { athleteId: athlete.id, lifecycleStatus: TrainingPlanLifecycle.ARCHIVED },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        totalWeeks: true,
        weeklyMileageTarget: true,
        goalRaceTime: true,
        updatedAt: true,
        raceId: true,
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

    const raceIds = [
      ...new Set(plans.map((p) => p.raceId).filter(Boolean) as string[]),
    ];

    const raceResults =
      raceIds.length > 0
        ? await prisma.athlete_race_results.findMany({
            where: { athleteId: athlete.id, raceRegistryId: { in: raceIds } },
            select: {
              raceRegistryId: true,
              officialFinishTime: true,
              finishTimeSeconds: true,
              goalTimeSeconds: true,
              goalTimeDeltaSeconds: true,
              goalAchieved: true,
              prAchieved: true,
              reflection: true,
            },
          })
        : [];

    const resultByRaceId = new Map(raceResults.map((r) => [r.raceRegistryId, r]));

    const serialized = plans.map((p) => {
      const result = p.raceId ? (resultByRaceId.get(p.raceId) ?? null) : null;
      return {
        id: p.id,
        name: p.name,
        startDate: ymdFromDate(p.startDate),
        totalWeeks: p.totalWeeks,
        weeklyMileageTarget: p.weeklyMileageTarget,
        goalRaceTime: p.goalRaceTime,
        race: p.race_registry
          ? {
              id: p.race_registry.id,
              name: p.race_registry.name,
              raceDate: ymdFromDate(p.race_registry.raceDate),
              distanceLabel: p.race_registry.distanceLabel,
            }
          : null,
        result: result
          ? {
              officialFinishTime: result.officialFinishTime,
              finishTimeSeconds: result.finishTimeSeconds,
              goalTimeSeconds: result.goalTimeSeconds,
              goalTimeDeltaSeconds: result.goalTimeDeltaSeconds,
              goalAchieved: result.goalAchieved,
              prAchieved: result.prAchieved,
              reflection: result.reflection,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, plans: serialized });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load archived plans";
    console.error("GET /api/training-plan/archived", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
