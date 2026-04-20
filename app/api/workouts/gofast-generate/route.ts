export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  parsePaceToSecondsPerMile,
  getTrainingPaces,
} from "@/lib/workout-generator/pace-calculator";
import { getPrimaryGoalForWorkout } from "@/lib/goal-service";
import {
  getTemplateSegments,
  descriptorsToApiSegments,
  type ApiSegment,
} from "@/lib/workout-generator/templates";
import type { TrainingPaces } from "@/lib/workout-generator/pace-calculator";

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

/** Pace shown in title/description must match template zones (not raw goal/marathon pace). */
function prescribedPaceSecPerMileForType(
  workoutType: string,
  paces: TrainingPaces
): number {
  switch (workoutType) {
    case "Tempo":
      return paces.tempo;
    case "LongRun":
      return paces.longRun;
    case "Intervals":
      return paces.interval;
    case "Race":
      return paces.marathon;
    case "Easy":
    default:
      return paces.easy;
  }
}

/** Pick total miles for workout type (e.g. 5–7 for Easy/Tempo/LongRun) */
function pickTotalMiles(workoutType: string): number {
  switch (workoutType) {
    case "Intervals":
      return 5;
    case "LongRun":
      return 8;
    case "Race":
      return 13.1;
    case "Tempo":
      return 6;
    case "Easy":
    default:
      return 6;
  }
}

export interface GoFastGenerateResponse {
  segments: ApiSegment[];
  suggestedTitle: string;
  suggestedDescription: string;
}

export interface GoFastGenerateNeedsPace {
  needsPace: true;
  message: string;
}

/**
 * POST /api/workouts/gofast-generate
 * Body: { workoutType: string }
 * Returns one workout from primary ACTIVE AthleteGoal.goalRacePace or Athlete.fiveKPace; or { needsPace: true }.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = (await request.json()) as { workoutType?: string; totalMiles?: number };
    const workoutType = body.workoutType ?? "Easy";
    const defaultMiles = pickTotalMiles(workoutType);
    const rawTotal = body.totalMiles;
    const totalMiles =
      typeof rawTotal === "number" &&
      Number.isFinite(rawTotal) &&
      rawTotal > 0 &&
      rawTotal <= 500
        ? rawTotal
        : defaultMiles;

    let goalSecPerMile: number | null = null;

    // 1) Primary ACTIVE AthleteGoal (goalRacePace sec/mile, with lazy backfill if needed)
    const primary = await getPrimaryGoalForWorkout(athlete.id);
    if (primary?.goalRacePace != null && primary.goalRacePace > 0) {
      goalSecPerMile = primary.goalRacePace;
    }

    // 2) Fallback: Athlete.fiveKPace
    if (goalSecPerMile == null && athlete.fiveKPace?.trim()) {
      try {
        goalSecPerMile = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
      } catch (_) {
        // ignore
      }
    }

    if (goalSecPerMile == null || goalSecPerMile <= 0) {
      return NextResponse.json(
        {
          needsPace: true,
          message:
            "Add an active goal with a finish time, or set your current 5K pace in your profile (e.g. 7:30 per mile).",
        } as GoFastGenerateNeedsPace,
        { status: 200 }
      );
    }

    const paces = getTrainingPaces(goalSecPerMile);
    const descriptors = getTemplateSegments(workoutType, totalMiles, paces);
    const segments = descriptorsToApiSegments(descriptors, paces);

    const prescribed = prescribedPaceSecPerMileForType(workoutType, paces);
    const prescribedStr = formatPaceFromSecondsPerMile(prescribed);
    const anchorStr = formatPaceFromSecondsPerMile(paces.goalSecondsPerMile);
    const suggestedTitle = `${totalMiles} Mile ${workoutType} @ ${prescribedStr}`;
    const suggestedDescription = `GoFast ${workoutType} workout, ${totalMiles} miles. Target ~${prescribedStr} (zones from ${anchorStr} anchor).`;

    const result: GoFastGenerateResponse = {
      segments,
      suggestedTitle,
      suggestedDescription,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Generate failed";
    console.error("Error in gofast-generate:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
