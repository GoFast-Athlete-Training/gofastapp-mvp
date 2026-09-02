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
import { reassignActivityToPlannedWorkout } from "@/lib/training/match-planned-workout";
import { loadPlannedWorkoutDetailForAthlete } from "@/lib/training/planned-workout-detail";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";
import {
  scoreAndSortActivityCandidates,
  workoutMatchCandidateUtcRange,
} from "@/lib/training/workout-activity-match-candidates";

type Ctx = { params: Promise<{ id: string }> };

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
  garmin_detail_activity: {
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

    let workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: workoutMatchInclude,
    });

    const plannedDetail =
      workout == null
        ? await loadPlannedWorkoutDetailForAthlete({
            plannedWorkoutId: id,
            athleteId: auth.athlete.id,
          })
        : null;

    const matchTarget = workout ?? (plannedDetail
      ? {
          id: plannedDetail.id,
          title: plannedDetail.title,
          date: plannedDetail.date,
          weekNumber: plannedDetail.weekNumber,
          dayAssigned: plannedDetail.dayAssigned,
          planId: plannedDetail.planId,
          estimatedDistanceInMeters: plannedDetail.estimatedDistanceInMeters,
          workoutType: plannedDetail.workoutType,
          garminDetailActivityId: plannedDetail.garminDetailActivityId,
          garmin_detail_activity: plannedDetail.garmin_detail_activity,
          workout_catalogue: plannedDetail.workout_catalogue
            ? { name: plannedDetail.workout_catalogue.name }
            : null,
        }
      : null);

    if (!matchTarget) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    if (matchTarget.garminDetailActivityId && matchTarget.garmin_detail_activity) {
      return NextResponse.json({
        workout: {
          id: matchTarget.id,
          title: matchTarget.title,
          date: matchTarget.date?.toISOString() ?? null,
          garminDetailActivityId: matchTarget.garminDetailActivityId,
        },
        matchedActivity: serializeActivity({
          ...matchTarget.garmin_detail_activity,
          paceSecPerMile: speedMpsToSecPerMile(matchTarget.garmin_detail_activity.averageSpeed),
        }),
        candidates: [],
      });
    }

    const dateRange = workoutMatchCandidateUtcRange(matchTarget.date);
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
        garmin_detail_workout: {
          select: { id: true, title: true, planId: true, date: true, weekNumber: true },
        },
      },
    });

    const runningActivities = activities.filter((a) =>
      isRunningActivityType(a.activityType)
    );

    const candidates = scoreAndSortActivityCandidates({
      workout: {
        id: matchTarget.id,
        title: matchTarget.title,
        weekNumber: matchTarget.weekNumber,
        date: matchTarget.date,
        estimatedDistanceInMeters: matchTarget.estimatedDistanceInMeters,
        workoutType: matchTarget.workoutType,
        dayAssigned: matchTarget.dayAssigned,
        planId: matchTarget.planId,
        catalogueName: matchTarget.workout_catalogue?.name ?? null,
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
        matchedWorkoutId: a.garmin_detail_workout?.id ?? null,
        matchedWorkoutTitle: a.garmin_detail_workout?.title ?? null,
      })),
    });

    return NextResponse.json({
      workout: {
        id: matchTarget.id,
        title: matchTarget.title,
        date: matchTarget.date?.toISOString() ?? null,
        garminDetailActivityId: matchTarget.garminDetailActivityId,
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
            targetWorkout: matchTarget,
            matchedWorkout: source?.garmin_detail_workout,
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

    const plannedRow =
      workout == null
        ? await prisma.planned_workouts.findFirst({
            where: { id, athleteId: auth.athlete.id },
            select: { id: true },
          })
        : null;

    if (!workout && !plannedRow) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const requestedActivityId =
      body.activityId === null ? null : body.activityId?.trim() || null;

    if (requestedActivityId === null) {
      if (workout) {
        const result = await clearActivityFromWorkout({
          workoutId: workout.id,
          athleteId: auth.athlete.id,
        });
        return NextResponse.json({ success: true, cleared: result.cleared });
      }
      return NextResponse.json({ success: true, cleared: false });
    }

    if (workout?.garminDetailActivityId === requestedActivityId) {
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

    if (plannedRow && !workout) {
      const reassignResult = await reassignActivityToPlannedWorkout({
        activityId: activity.id,
        plannedWorkoutId: plannedRow.id,
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
    }

    const reassignResult = await reassignActivityToWorkout({
      activityId: activity.id,
      targetWorkoutId: workout!.id,
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
