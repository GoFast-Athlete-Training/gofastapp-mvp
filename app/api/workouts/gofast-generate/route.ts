export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { getTrainingPaces } from "@/lib/workout-generator/pace-calculator";
import { getPrimaryGoalForWorkout } from "@/lib/goal-service";
import {
  getTemplateSegments,
  descriptorsToWorkoutSteps,
  type WorkoutStep,
} from "@/lib/training/prescription";
import type { TrainingPaces } from "@/lib/workout-generator/pace-calculator";
import {
  athleteContextFromRow,
  goalContextFromPrimaryGoal,
  prescribeCatalogueEntry,
  resolvePrescriptionAnchors,
} from "@/lib/training/standalone-catalogue-prescription";

function formatPaceFromSecondsPerMile(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

/** Pace shown in title/description must match template zones (5K anchor). */
function prescribedPaceSecPerMileForType(
  workoutType: string,
  paces: TrainingPaces
): number {
  switch (workoutType) {
    case "Tempo":
    case "SpeedDuration":
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
    case "SpeedDuration":
      return 6;
    case "Easy":
    default:
      return 6;
  }
}

export interface GoFastGenerateResponse {
  segments: WorkoutStep[];
  suggestedTitle: string;
  suggestedDescription: string;
}

export interface GoFastGenerateNeedsPace {
  needsPace: true;
  message: string;
}

/**
 * POST /api/workouts/gofast-generate
 * Body: { workoutType?: string; totalMiles?: number; catalogueId?: string }
 * Returns segments from a catalogue row or generic template; anchor on profile 5K pace.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = (await request.json()) as {
      workoutType?: string;
      totalMiles?: number;
      catalogueId?: string;
    };
    const workoutType = body.workoutType ?? "Easy";

    const primary = await getPrimaryGoalForWorkout(athlete.id);
    const goalCtx = goalContextFromPrimaryGoal(primary);
    const athleteCtx = athleteContextFromRow(athlete);
    const anchors = resolvePrescriptionAnchors(athleteCtx, goalCtx);

    if ("needsFiveKPace" in anchors) {
      return NextResponse.json(
        {
          needsPace: true,
          message:
            "Set your current 5K pace in your profile (e.g. 6:22 per mile). Plan workouts use the same anchor.",
        } as GoFastGenerateNeedsPace,
        { status: 200 }
      );
    }

    const paces = getTrainingPaces(anchors.anchorSecPerMile);

    if (body.catalogueId?.trim()) {
      const entry = await prisma.workout_catalogue.findUnique({
        where: { id: body.catalogueId.trim() },
      });
      if (!entry) {
        return NextResponse.json({ error: "Catalogue workout not found" }, { status: 404 });
      }

      const catType = String(entry.workoutType);
      const defaultMiles = pickTotalMiles(catType);
      const rawTotal = body.totalMiles;
      const scheduleMiles =
        typeof rawTotal === "number" &&
        Number.isFinite(rawTotal) &&
        rawTotal > 0 &&
        rawTotal <= 500
          ? rawTotal
          : defaultMiles;

      const { steps: segments } = prescribeCatalogueEntry({
        entry,
        scheduleMiles,
        athlete: athleteCtx,
        goal: goalCtx,
      });

      const prescribedStr = formatPaceFromSecondsPerMile(
        prescribedPaceSecPerMileForType(catType, paces)
      );

      const desc =
        typeof entry.description === "string" && entry.description.trim()
          ? entry.description.trim()
          : `Prescription from training catalogue. Target work pace ~${prescribedStr}.`;

      const result: GoFastGenerateResponse = {
        segments,
        suggestedTitle: entry.name.trim() || `${catType} workout`,
        suggestedDescription: desc,
      };
      return NextResponse.json(result);
    }

    const defaultMiles = pickTotalMiles(workoutType);
    const rawTotal = body.totalMiles;
    const totalMiles =
      typeof rawTotal === "number" &&
      Number.isFinite(rawTotal) &&
      rawTotal > 0 &&
      rawTotal <= 500
        ? rawTotal
        : defaultMiles;

    const descriptors = getTemplateSegments(workoutType, totalMiles, paces);
    const segments = descriptorsToWorkoutSteps(descriptors, paces);

    const prescribed = prescribedPaceSecPerMileForType(workoutType, paces);
    const prescribedStr = formatPaceFromSecondsPerMile(prescribed);
    const anchorStr = formatPaceFromSecondsPerMile(paces.goalSecondsPerMile);
    const suggestedTitle = `${totalMiles} Mile ${workoutType} @ ${prescribedStr}`;
    const suggestedDescription = `GoFast ${workoutType} workout, ${totalMiles} miles. Target ~${prescribedStr} (zones from ${anchorStr} 5K anchor).`;

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
