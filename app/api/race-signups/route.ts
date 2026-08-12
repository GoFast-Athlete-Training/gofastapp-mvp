export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import {
  findActivePlanForAthlete,
  signupAffectsActivePlan,
} from "@/lib/training/plan-race-events";
import { previewRaceImpactOnPlan } from "@/lib/training/plan-race-impact";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

const raceInclude = {
  select: {
    id: true,
    slug: true,
    name: true,
    distanceLabel: true,
    distanceMeters: true,
    raceDate: true,
    city: true,
    state: true,
    country: true,
    registrationUrl: true,
    startTime: true,
    logoUrl: true,
  },
} as const;

/** GET /api/race-signups — my self-declared races, ordered by race date */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const signups = await prisma.athlete_race_signups.findMany({
      where: { athleteId: athlete!.id },
      include: { race_registry: raceInclude },
      orderBy: { race_registry: { raceDate: "asc" } },
    });

    return NextResponse.json({ signups });
  } catch (err: unknown) {
    console.error("GET /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/race-signups — body { raceRegistryId, goalId? } */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const raceRegistryId =
      typeof body.raceRegistryId === "string" ? body.raceRegistryId.trim() : "";
    const goalIdExplicit = Object.prototype.hasOwnProperty.call(body, "goalId");
    const goalIdResolved =
      goalIdExplicit && typeof body.goalId === "string" && body.goalId.trim()
        ? body.goalId.trim()
        : goalIdExplicit
          ? null
          : undefined;

    if (!raceRegistryId) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId, isActive: true, isCancelled: false },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (goalIdResolved) {
      const goal = await prisma.athleteGoal.findFirst({
        where: { id: goalIdResolved, athleteId: athlete!.id },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
    }

    const signup = await prisma.athlete_race_signups.upsert({
      where: {
        athleteId_raceRegistryId: {
          athleteId: athlete!.id,
          raceRegistryId,
        },
      },
      create: {
        athleteId: athlete!.id,
        raceRegistryId,
        goalId: goalIdExplicit ? goalIdResolved ?? null : null,
      },
      update: goalIdExplicit ? { goalId: goalIdResolved ?? null } : {},
      include: { race_registry: raceInclude },
    });

    await upsertRaceMembershipFromSignup(athlete!.id, raceRegistryId);
    await syncAthleteProfileSnapshot(athlete!.id);

    const planImpact = await signupAffectsActivePlan({
      athleteId: athlete!.id,
      raceRegistryId,
      raceDate: race.raceDate,
    });

    let impactPreview = null;
    if (planImpact.affectsPlan && planImpact.planId) {
      const activePlan = await findActivePlanForAthlete(athlete!.id);
      if (activePlan?.planSchedule) {
        impactPreview = previewRaceImpactOnPlan({
          planId: planImpact.planId,
          planStart: activePlan.startDate,
          totalWeeks: activePlan.totalWeeks,
          planSchedule: activePlan.planSchedule,
          event: {
            raceRegistryId: race.id,
            raceName: race.name,
            raceDate: race.raceDate,
            distanceMeters: race.distanceMeters,
          },
        });
      }
    }

    return NextResponse.json({
      signup,
      planImpact,
      impactPreview,
    });
  } catch (err: unknown) {
    console.error("POST /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
