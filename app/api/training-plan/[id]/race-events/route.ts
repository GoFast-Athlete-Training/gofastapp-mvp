export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { listSecondaryCandidatesForPlan } from "@/lib/training/race-plan-calendar-service";
import { parseAthleteRaceMainSnap } from "@/lib/training/plan-race-snapshots";
import { currentTrainingWeekNumber } from "@/lib/training/plan-utils";
import {
  computePendingCandidates,
  getSnappedAthleteRaceIds,
  serializePlanRaceEventCandidate,
} from "@/lib/training/plan-pending-races";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/race-events — secondary bolt-on + pending detection */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: {
        athlete_race: true,
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const mainSnap = parseAthleteRaceMainSnap(plan.athleteRaceMainSnap);
    const terminalDate =
      plan.athlete_race?.raceDate ??
      (mainSnap ? new Date(mainSnap.raceDate) : null);
    if (!terminalDate) {
      return NextResponse.json({ error: "Plan has no terminal race date" }, { status: 404 });
    }

    const rawCandidates = await listSecondaryCandidatesForPlan({
      athleteId: auth.athlete.id,
      planStart: plan.startDate,
      terminalRaceDate: terminalDate,
      athleteRaceId: plan.athleteRaceId,
    });

    const candidates = rawCandidates.map(serializePlanRaceEventCandidate);
    const snappedAthleteRaceIds = getSnappedAthleteRaceIds(plan.athleteRaceAlongWaySnaps);
    const pendingCandidates = computePendingCandidates(candidates, snappedAthleteRaceIds);
    const needsRegenerate = pendingCandidates.length > 0;

    const terminalRace = plan.athlete_race
      ? {
          athleteRaceId: plan.athlete_race.id,
          name: plan.athlete_race.name,
        }
      : mainSnap
        ? {
            athleteRaceId: mainSnap.sourceAthleteRaceId,
            name: mainSnap.name,
          }
        : null;

    const focusAthleteRaceId = request.nextUrl.searchParams
      .get("focusAthleteRaceId")
      ?.trim();
    let focusWeekNumber: number | null = null;
    if (focusAthleteRaceId) {
      const focusRow =
        rawCandidates.find((ar) => ar.id === focusAthleteRaceId) ??
        (plan.athlete_race?.id === focusAthleteRaceId ? plan.athlete_race : null);
      if (focusRow) {
        focusWeekNumber = currentTrainingWeekNumber(
          plan.startDate,
          plan.totalWeeks,
          focusRow.raceDate
        );
      }
    }

    return NextResponse.json({
      candidates,
      snappedAthleteRaceIds,
      pendingCandidates,
      needsRegenerate,
      terminalRace,
      focusWeekNumber,
    });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load plan race events" },
      { status: 500 }
    );
  }
}
