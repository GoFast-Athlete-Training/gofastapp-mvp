export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { snapPrimaryRaceToPlanTerminal } from "@/lib/athlete-primary-race";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { totalWeeksFromDates } from "@/lib/training/plan-utils";
import { TrainingPlanLifecycle } from "@prisma/client";
import { goalRacePaceDisplayString, resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import { metersToMiles } from "@/lib/pace-utils";
import {
  presetMatchesRaceDistance,
  raceDistanceForPresetMatch,
} from "@/lib/training/preset-distance-match";
import { claimAthleteRace, findAthleteRaceByRegistry } from "@/lib/athlete-races-service";
import {
  listSecondaryCandidatesForPlan,
} from "@/lib/training/race-plan-calendar-service";
import {
  buildPlanRaceSnapshots,
  planRaceSnapshotsToPrismaJson,
} from "@/lib/training/plan-race-snapshots";
import { isRaceCalendarBeforeTodayUtc } from "@/lib/training/plan-lifecycle";
import { cleanupFutureGarminSchedulesForPlan } from "@/lib/training/plan-garmin-cleanup";
import { isAthletePresetBlueprintComplete } from "@/lib/training/athlete-preset-blueprint";

/**
 * POST /api/training-plan
 * Create a training plan. Requires athleteRaceId (race + goal time on that row).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const {
      raceRegistryId,
      athleteRaceId: bodyAthleteRaceId,
      startDate: startRaw,
      name,
      currentWeeklyMileage,
      preferredDays: bodyPreferredDays,
      fiveKPace: bodyFiveK,
      current5KPace: bodyLegacy5k,
      syncAthleteBaseline,
      presetId: bodyPresetId,
      athletePresetId: bodyAthletePresetId,
      replaceActivePlan,
      retireActivePlan: bodyRetireActivePlan,
    } = body;
    const body5k = bodyFiveK ?? bodyLegacy5k;

    if (
      !bodyAthleteRaceId &&
      (!raceRegistryId || typeof raceRegistryId !== "string")
    ) {
      return NextResponse.json(
        { error: "athleteRaceId or raceRegistryId is required" },
        { status: 400 }
      );
    }

    if (!startRaw) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }

    let terminalAthleteRace =
      typeof bodyAthleteRaceId === "string" && bodyAthleteRaceId.trim()
        ? await prisma.athlete_races.findFirst({
            where: { id: bodyAthleteRaceId.trim(), athleteId: athlete.id },
          })
        : raceRegistryId
          ? await findAthleteRaceByRegistry({
              athleteId: athlete.id,
              raceRegistryId,
            })
          : null;

    if (!terminalAthleteRace && raceRegistryId) {
      const claimed = await claimAthleteRace({
        athleteId: athlete.id,
        raceRegistryId,
      });
      terminalAthleteRace = await prisma.athlete_races.findFirst({
        where: { id: claimed.id, athleteId: athlete.id },
      });
    }

    if (!terminalAthleteRace) {
      return NextResponse.json(
        { error: "Pick a terminal race for this plan (athleteRaceId or raceRegistryId)" },
        { status: 400 }
      );
    }

    const gt =
      typeof terminalAthleteRace.goalTime === "string"
        ? terminalAthleteRace.goalTime.trim()
        : "";
    if (!gt) {
      return NextResponse.json(
        { error: "Race must have a goal time set — finish your goal first" },
        { status: 400 }
      );
    }

    const race = await prisma.race_registry.findUnique({
      where: { id: terminalAthleteRace.raceRegistryId },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (isRaceCalendarBeforeTodayUtc(race.raceDate)) {
      return NextResponse.json(
        { error: "That race has finished — pick an upcoming race to train for" },
        { status: 400 }
      );
    }

    if (
      raceRegistryId &&
      raceRegistryId !== terminalAthleteRace.raceRegistryId &&
      !bodyAthleteRaceId
    ) {
      return NextResponse.json(
        { error: "raceRegistryId must match the selected terminal athlete race" },
        { status: 400 }
      );
    }

    const startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const raceDate = new Date(race.raceDate);
    if (startDate >= raceDate) {
      return NextResponse.json(
        { error: "Plan startDate must be before race date" },
        { status: 400 }
      );
    }

    const totalWeeks = totalWeeksFromDates(startDate, raceDate);

    const raceDistanceMilesForPace = (() => {
      const athleteMeters =
        terminalAthleteRace.distanceMeters != null &&
        Number.isFinite(Number(terminalAthleteRace.distanceMeters))
          ? Math.round(Number(terminalAthleteRace.distanceMeters))
          : null;
      const registryMeters =
        race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
          ? Math.round(Number(race.distanceMeters))
          : null;
      const meters = athleteMeters ?? registryMeters;
      if (meters == null || meters <= 0) return null;
      return metersToMiles(meters);
    })();
    if (raceDistanceMilesForPace == null) {
      return NextResponse.json(
        {
          error:
            "Confirm your race distance in plan setup before creating a training plan.",
        },
        { status: 422 }
      );
    }
    const resolvedGoalPace = resolveGoalRacePace({
      goalTime: gt,
      dbGoalRacePaceSecPerMile: terminalAthleteRace.goalRacePace ?? null,
      distanceMeters: race.distanceMeters ?? null,
      distanceLabel: race.distanceLabel ?? null,
      goalDistance: terminalAthleteRace.goalDistance ?? null,
    });
    const imprintedGoalPace =
      resolvedGoalPace.goalPaceDisplay ??
      goalRacePaceDisplayString(gt, raceDistanceMilesForPace);

    const prefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: athlete.id },
    });

    const preferredDays =
      Array.isArray(bodyPreferredDays) && bodyPreferredDays.length
        ? bodyPreferredDays.map((n: unknown) => Number(n)).filter((n) => n >= 1 && n <= 7)
        : prefs?.preferredDays?.length
          ? prefs.preferredDays
          : [];

    const fiveKPaceResolved =
      typeof body5k === "string" ? body5k.trim() || null : athlete.fiveKPace ?? null;

    let weeklyResolved: number | null = athlete.weeklyMileage ?? null;
    if (
      currentWeeklyMileage !== undefined &&
      currentWeeklyMileage !== null &&
      currentWeeklyMileage !== ""
    ) {
      const n = Number(currentWeeklyMileage);
      if (Number.isFinite(n)) weeklyResolved = n;
    } else if (currentWeeklyMileage === "" || currentWeeklyMileage === null) {
      weeklyResolved = null;
    }

    const planName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : `Training — ${race.name}`;

    if (bodyPresetId == null && bodyAthletePresetId == null) {
      return NextResponse.json(
        {
          error:
            "presetId or athletePresetId is required — pick a training blueprint in setup.",
        },
        { status: 400 }
      );
    }

    if (bodyPresetId != null && bodyAthletePresetId != null) {
      return NextResponse.json(
        { error: "Provide presetId or athletePresetId, not both" },
        { status: 400 }
      );
    }

    let presetIdResolved: string | null = null;
    let athletePresetIdResolved: string | null = null;

    if (bodyAthletePresetId != null && String(bodyAthletePresetId).trim()) {
      const apId = String(bodyAthletePresetId).trim();
      const athletePreset = await prisma.athlete_presets.findFirst({
        where: { id: apId, athleteId: athlete.id },
      });
      if (!athletePreset) {
        return NextResponse.json({ error: "athletePresetId not found" }, { status: 404 });
      }
      if (!isAthletePresetBlueprintComplete(athletePreset)) {
        return NextResponse.json(
          { error: "Finish building your athlete preset before creating a plan." },
          { status: 422 }
        );
      }
      athletePresetIdResolved = athletePreset.id;
    } else if (bodyPresetId != null && bodyPresetId !== "") {
      const pid = String(bodyPresetId).trim();
      const preset = await prisma.training_plan_preset.findUnique({
        where: { id: pid },
        select: { id: true, targetDistanceLabel: true },
      });
      if (!preset) {
        return NextResponse.json({ error: "presetId not found" }, { status: 400 });
      }
      const raceDistanceInput = {
        athleteRaceMeters: terminalAthleteRace.distanceMeters,
        registryMeters: race.distanceMeters,
        distanceLabel:
          terminalAthleteRace.distanceLabel ?? race.distanceLabel ?? null,
      };
      const raceDistance = raceDistanceForPresetMatch(raceDistanceInput);
      if (!presetMatchesRaceDistance(preset.targetDistanceLabel, raceDistanceInput)) {
        return NextResponse.json(
          {
            error: `This training level is built for a ${preset.targetDistanceLabel ?? "specific distance"}. Your goal race${raceDistance.label ? ` (${raceDistance.label})` : ""} does not match.`,
          },
          { status: 422 }
        );
      }
      presetIdResolved = preset.id;
    }

    const existingActive = await prisma.training_plans.findFirst({
      where: {
        athleteId: athlete.id,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      select: { id: true, name: true },
    });
    if (existingActive && replaceActivePlan !== true && replaceActivePlan !== "true") {
      return NextResponse.json(
        {
          error:
            "You already have an active training plan. Set replaceActivePlan: true to replace it, or archive/delete the current plan first.",
          existingActivePlanId: existingActive.id,
        },
        { status: 409 }
      );
    }

    const allAthleteRaces = await prisma.athlete_races.findMany({
      where: { athleteId: athlete.id },
      orderBy: { raceDate: "asc" },
    });
    const raceSnapshots = buildPlanRaceSnapshots({
      mainRow: terminalAthleteRace,
      planStart: startDate,
      allAthleteRaces,
    });

    const now = new Date();
    const plan = await prisma.$transaction(async (tx) => {
      if (existingActive) {
        const retireMode =
          bodyRetireActivePlan === "archive" ? "archive" : "park";
        if (retireMode === "archive") {
          await tx.training_plans.updateMany({
            where: {
              athleteId: athlete.id,
              lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
            },
            data: {
              lifecycleStatus: TrainingPlanLifecycle.ARCHIVED,
              updatedAt: now,
            },
          });
        } else {
          await tx.training_plans.updateMany({
            where: {
              athleteId: athlete.id,
              lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
            },
            data: {
              lifecycleStatus: TrainingPlanLifecycle.PARKED,
              updatedAt: now,
            },
          });
        }
      }
      return tx.training_plans.create({
        data: {
          id: randomUUID(),
          athleteId: athlete.id,
          athleteRaceId: terminalAthleteRace.id,
          ...planRaceSnapshotsToPrismaJson(raceSnapshots),
          name: planName,
          startDate,
          totalWeeks,
          currentWeeklyMileage: weeklyResolved,
          /// Set on the preferences screen after plan creation — not the wizard baseline.
          weeklyMileageTarget: null,
          currentFiveKPace: fiveKPaceResolved,
          goalRaceTime: gt,
          ...(imprintedGoalPace ? { goalRacePace: imprintedGoalPace } : {}),
          lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
          preferredDays,
          presetId: presetIdResolved,
          athletePresetId: athletePresetIdResolved,
          updatedAt: now,
        },
      });
    });

    if (existingActive && bodyRetireActivePlan === "archive") {
      await cleanupFutureGarminSchedulesForPlan({
        planId: existingActive.id,
        athleteId: athlete.id,
      });
    }

    await snapPrimaryRaceToPlanTerminal({
      athleteId: athlete.id,
      athleteRaceId: terminalAthleteRace.id,
    });

    if (syncAthleteBaseline === true || syncAthleteBaseline === "true") {
      await prisma.athlete.update({
        where: { id: athlete.id },
        data: {
          fiveKPace: fiveKPaceResolved,
          weeklyMileage: weeklyResolved,
        },
      });
    }

    const athleteFiveKPaceAfter =
      syncAthleteBaseline === true || syncAthleteBaseline === "true"
        ? fiveKPaceResolved
        : athlete.fiveKPace ?? null;

    const secondaryCandidates = await listSecondaryCandidatesForPlan({
      athleteId: athlete.id,
      planStart: startDate,
      terminalRaceDate: raceDate,
      athleteRaceId: terminalAthleteRace.id,
    });

    return NextResponse.json({
      plan,
      athleteFiveKPace: athleteFiveKPaceAfter,
      secondaryCandidates: secondaryCandidates.map((ar) => ({
        athleteRaceId: ar.id,
        raceRegistryId: ar.raceRegistryId,
        race: {
          name: ar.name,
          raceDate: ar.raceDate.toISOString(),
          distanceLabel: ar.distanceLabel,
        },
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create plan";
    console.error("POST /api/training-plan", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/training-plan — list athlete's plans (light)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const statusParam = request.nextUrl.searchParams.get("status")?.toLowerCase();
    const lifecycleFilter =
      statusParam === "active"
        ? TrainingPlanLifecycle.ACTIVE
        : statusParam === "parked"
          ? TrainingPlanLifecycle.PARKED
          : statusParam === "archived"
            ? {
                in: [
                  TrainingPlanLifecycle.ARCHIVED,
                  TrainingPlanLifecycle.PARKED,
                ],
              }
            : null;

    const plans = await prisma.training_plans.findMany({
      where: {
        athleteId: athlete.id,
        ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        totalWeeks: true,
        raceId: true,
        athleteRaceId: true,
        phases: true,
        planSchedule: true,
        weeklyMileageTarget: true,
        lifecycleStatus: true,
        currentFiveKPace: true,
        createdAt: true,
        updatedAt: true,
        race_registry: { select: { name: true } },
        _count: { select: { planned_workouts: true } },
      },
    });

    return NextResponse.json({ plans });
  } catch (e: unknown) {
    console.error("GET /api/training-plan", e);
    return NextResponse.json({ error: "Failed to list plans" }, { status: 500 });
  }
}
