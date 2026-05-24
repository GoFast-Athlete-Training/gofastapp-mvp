export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  classifyActivityLinkConflict,
  clearActivityFromWorkout,
  reassignActivityToWorkout,
  type ActivityLinkConflict,
} from "@/lib/training/apply-activity-to-workout";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";
import {
  scoreAndSortActivityCandidates,
  workoutMatchCandidateUtcRange,
} from "@/lib/training/workout-activity-match-candidates";

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

function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function conflictForCandidate(params: {
  targetWorkout: {
    id: string;
    title: string;
    date: Date | null;
    weekNumber: number | null;
    planId: string | null;
  };
  matchedWorkout:
    | {
        id: string;
        title: string;
        date: Date | null;
        weekNumber: number | null;
        planId: string | null;
      }
    | null
    | undefined;
}): ActivityLinkConflict | null {
  if (!params.matchedWorkout || params.matchedWorkout.id === params.targetWorkout.id) {
    return null;
  }
  const type = classifyActivityLinkConflict({
    targetWorkout: params.targetWorkout,
    existingWorkout: params.matchedWorkout,
  });
  if (type === "same_workout") return null;
  return {
    type,
    workoutId: params.matchedWorkout.id,
    workoutTitle: params.matchedWorkout.title,
  };
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
  reasonLabels?: string[];
  score?: number;
  conflict?: ActivityLinkConflict | null;
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
    ...(row.reasonLabels ? { reasonLabels: row.reasonLabels } : {}),
    ...(row.score != null ? { score: row.score } : {}),
    conflict: row.conflict ?? null,
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
          paceSecPerMile: speedMpsToSecPerMile(workout.matched_activity.averageSpeed),
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
        matched_workout: {
          select: { id: true, title: true, planId: true, date: true, weekNumber: true },
        },
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
      candidates: candidates.map((c) => {
        const source = runningActivities.find((a) => a.id === c.id);
        return serializeActivity({
          id: c.id,
          activityName: c.activityName,
          activityType: c.activityType,
          startTime: c.startTime,
          ingestionStatus: c.ingestionStatus,
          distance: c.distance,
          duration: c.duration,
          averageSpeed: c.averageSpeed,
          paceSecPerMile: c.paceSecPerMile,
          reasonLabels: c.reasonLabels,
          score: c.score,
          conflict: conflictForCandidate({
            targetWorkout: workout,
            matchedWorkout: source?.matched_workout,
          }),
        });
      }),
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

    const reassignResult = await reassignActivityToWorkout({
      activityId: activity.id,
      targetWorkoutId: workout.id,
      athleteId: auth.athlete.id,
    });

    if (!reassignResult.success) {
      return NextResponse.json(
        {
          error: `Activity is already linked to "${reassignResult.conflict.workoutTitle}"`,
          conflict: reassignResult.conflict,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      workoutId: reassignResult.workoutId,
      reassignedFrom: reassignResult.reassignedFrom ?? null,
    });
  } catch (error: unknown) {
    console.error("POST /api/workouts/[id]/match-activity", error);
    return NextResponse.json({ error: "Failed to match activity" }, { status: 500 });
  }
}
