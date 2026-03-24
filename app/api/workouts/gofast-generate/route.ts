export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { adminAuth } from "@/lib/firebaseAdmin";
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

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

/** Pick total miles for workout type (e.g. 5–7 for Easy/Tempo/LongRun) */
function pickTotalMiles(workoutType: string): number {
  switch (workoutType) {
    case "Intervals":
      return 5;
    case "LongRun":
      return 8;
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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = (await request.json()) as { workoutType?: string };
    const workoutType = body.workoutType ?? "Easy";

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
            "Set an active goal on /goals with a goal time, or add your 5K pace in profile.",
        } as GoFastGenerateNeedsPace,
        { status: 200 }
      );
    }

    const paces = getTrainingPaces(goalSecPerMile);
    const totalMiles = pickTotalMiles(workoutType);
    const descriptors = getTemplateSegments(workoutType, totalMiles, paces);
    const segments = descriptorsToApiSegments(descriptors, paces);

    const suggestedTitle = `${totalMiles} Mile ${workoutType} @ ${formatPaceFromSecondsPerMile(paces.goalSecondsPerMile)}`;
    const suggestedDescription = `GoFast ${workoutType} workout, ${totalMiles} miles. Goal pace ${formatPaceFromSecondsPerMile(paces.goalSecondsPerMile)}.`;

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
