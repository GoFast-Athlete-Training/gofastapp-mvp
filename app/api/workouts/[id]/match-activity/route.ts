export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  applyActivityToWorkout,
  clearActivityFromWorkout,
} from "@/lib/training/apply-activity-to-workout";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";
import {
  scoreAndSortActivityCandidates,
  workoutMatchCandidateUtcRange,
} from "@/lib/training/workout-activity-match-candidates";
import { runRunAssessment } from "@/lib/training/run-assessment-service";

type Ctx = { params: Promise<{ id: string }> };

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true } },
  matched_activity: {
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      ingestionStatus: true,
      distance: true,
      duration: true,
      averageSpeed: true,
    },
  },
};

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

function serializeActivity(row: {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: Date | null;
  ingestionStatus: string;
  distance: number | null;
  duration: number | null;
  averageSpeed: number | null;
  paceSecPerMile?: number | null;
  matchedWorkoutId?: string | null;
  matchedWorkoutTitle?: string | null;
  reasons?: string[];
  reasonLabels?: string[];
  score?: number;
}) {
  const paceSecPerMile =
    row.paceSecPerMile ??
    (row.averageSpeed != null && row.averageSpeed > 0
      ? Math.round(1609.34 / row.averageSpeed)
      : null);

  return {
    id: row.id,
    activityName: row.activityName,
    activityType: row.activityType,
    startTime: row.startTime?.toISOString() ?? null,
    ingestionStatus: row.ingestionStatus,
    distance: row.distance,
    duration: row.duration,
    averageSpeed: row.averageSpeed,
    paceSecPerMile,
    matchedWorkoutId: row.matchedWorkoutId ?? null,
    matchedWorkoutTitle: row.matchedWorkoutTitle ?? null,
    ...(row.reasons ? { reasons: row.reasons } : {}),
    ...(row.reasonLabels ? { reasonLabels: row.reasonLabels } : {}),
    ...(row.score != null ? { score: row.score } : {}),
  };
}

/**
 * GET /api/workouts/[id]/match-activity
 * Candidate Garmin activities for manual workout matching.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;
    const workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: workoutMatchInclude,
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    if (workout.matchedActivityId && workout.matched_activity) {
      return NextResponse.json({
        workout: {
          id: workout.id,
          title: workout.title,
          date: workout.date?.toISOString() ?? null,
          matchedActivityId: workout.matchedActivityId,
        },
        matchedActivity: serializeActivity({
          ...workout.matched_activity,
          matchedWorkoutId: workout.id,
          matchedWorkoutTitle: workout.title,
        }),
        candidates: [],
      });
    }

    const dateRange = workoutMatchCandidateUtcRange(workout.date);
    const activityWhere: {
      athleteId: string;
      startTime?: { gte: Date; lt: Date };
    } = { athleteId: auth.athlete.id };

    if (dateRange) {
      activityWhere.startTime = { gte: dateRange.start, lt: dateRange.end };
    }

    const activities = await prisma.athlete_activities.findMany({
      where: activityWhere,
      orderBy: { startTime: "desc" },
      take: 60,
      select: {
        id: true,
        activityName: true,
        activityType: true,
        startTime: true,
        duration: true,
        distance: true,
        averageSpeed: true,
        ingestionStatus: true,
        summaryData: true,
        matched_workout: { select: { id: true, title: true } },
      },
    });

    const runningActivities = activities.filter((a) =>
      isRunningActivityType(a.activityType)
    );

    const candidates = scoreAndSortActivityCandidates({
      workout: {
        id: workout.id,
        title: workout.title,
        weekNumber: workout.weekNumber,
        date: workout.date,
        estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
      },
      activities: runningActivities.map((a) => ({
        id: a.id,
        activityName: a.activityName,
        activityType: a.activityType,
        startTime: a.startTime,
        duration: a.duration,
        distance: a.distance,
        averageSpeed: a.averageSpeed,
        ingestionStatus: a.ingestionStatus,
        summaryData: a.summaryData,
        matchedWorkoutId: a.matched_workout?.id ?? null,
        matchedWorkoutTitle: a.matched_workout?.title ?? null,
      })),
    });

    return NextResponse.json({
      workout: {
        id: workout.id,
        title: workout.title,
        date: workout.date?.toISOString() ?? null,
        matchedActivityId: workout.matchedActivityId,
      },
      matchedActivity: null,
      candidates: candidates.map((c) =>
        serializeActivity({
          id: c.id,
          activityName: c.activityName,
          activityType: c.activityType,
          startTime: c.startTime,
          ingestionStatus: c.ingestionStatus,
          distance: c.distance,
          duration: c.duration,
          averageSpeed: c.averageSpeed,
          paceSecPerMile: c.paceSecPerMile,
          matchedWorkoutId: c.matchedWorkoutId,
          matchedWorkoutTitle: c.matchedWorkoutTitle,
          reasonLabels: c.reasonLabels,
          score: c.score,
        })
      ),
    });
  } catch (error: unknown) {
    console.error("GET /api/workouts/[id]/match-activity", error);
    return NextResponse.json({ error: "Failed to load match candidates" }, { status: 500 });
  }
}

/**
 * POST /api/workouts/[id]/match-activity
 * Body: { activityId: string } to link, { activityId: null } to clear.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;

    let body: { activityId?: string | null };
    try {
      body = (await request.json()) as { activityId?: string | null };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!("activityId" in body)) {
      return NextResponse.json({ error: "activityId is required" }, { status: 400 });
    }

    const workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: workoutMatchInclude,
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const requestedActivityId =
      body.activityId === null ? null : body.activityId?.trim() || null;

    if (requestedActivityId === null) {
      const result = await clearActivityFromWorkout({
        workoutId: workout.id,
        athleteId: auth.athlete.id,
      });
      return NextResponse.json({ success: true, cleared: result.cleared });
    }

    if (workout.matchedActivityId && workout.matchedActivityId !== requestedActivityId) {
      return NextResponse.json(
        { error: "Workout is already linked to a different activity" },
        { status: 409 }
      );
    }

    if (workout.matchedActivityId === requestedActivityId) {
      return NextResponse.json({ success: true, workoutId: workout.id, alreadyMatched: true });
    }

    const activity = await prisma.athlete_activities.findFirst({
      where: { id: requestedActivityId, athleteId: auth.athlete.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!activity.startTime) {
      return NextResponse.json(
        { error: "Activity has no start time; cannot match" },
        { status: 400 }
      );
    }

    if (!isRunningActivityType(activity.activityType)) {
      return NextResponse.json(
        { error: "Only running activities can be matched to a workout" },
        { status: 400 }
      );
    }

    const existingLink = await prisma.workouts.findFirst({
      where: {
        athleteId: auth.athlete.id,
        matchedActivityId: activity.id,
        id: { not: workout.id },
      },
      select: { id: true, title: true },
    });

    if (existingLink) {
      return NextResponse.json(
        {
          error: `Activity is already linked to "${existingLink.title}"`,
          linkedWorkoutId: existingLink.id,
        },
        { status: 409 }
      );
    }

    const { workoutId } = await applyActivityToWorkout({ workout, activity });

    void runRunAssessment({
      workoutId,
      athleteId: auth.athlete.id,
    }).catch((e) => console.error("runRunAssessment after manual match:", e));

    return NextResponse.json({ success: true, workoutId });
  } catch (error: unknown) {
    console.error("POST /api/workouts/[id]/match-activity", error);
    return NextResponse.json({ error: "Failed to match activity" }, { status: 500 });
  }
}
