/**
 * When a running activity does not match a planned workout, promote it to a canonical
 * standalone `workouts` row so volume and downstream analysis are not lost.
 */

import { prisma } from "@/lib/prisma";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";
import { applyAerobicCeilingCredit } from "@/lib/training/apply-aerobic-ceiling-credit";
import {
  activityLocalYmdFromSummary,
  activityMatchCandidateUtcRange,
  activityNameHasPushedWorkoutMarker,
} from "@/lib/training/garmin-activity-match-helpers";
import {
  isHighConfidenceActivityCandidate,
  scoreActivityCandidateForWorkout,
  type ScoredActivityCandidate,
} from "@/lib/training/workout-activity-match-candidates";
import { plannedDayConsumedByOtherActivity } from "@/lib/training/match-planned-workout";

/** m/s → seconds per mile */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

/** True when a nearby unmatched planned workout could still claim this activity. */
export function isPlausiblePlannedWorkoutNearby(params: {
  scored: Pick<ScoredActivityCandidate, "reasons">;
}): boolean {
  if (params.scored.reasons.includes("title_match")) return true;
  if (isHighConfidenceActivityCandidate(params.scored)) return true;
  if (params.scored.reasons.includes("same_day")) return true;
  return false;
}

export async function promoteUnmatchedRunningActivityToWorkout(
  athleteActivityId: string
): Promise<{
  promoted: boolean;
  workoutId?: string;
  alreadyLinked?: boolean;
  blockedByPlannedWorkout?: boolean;
}> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });
  if (!activity?.startTime) {
    return { promoted: false };
  }

  if (!isRunningActivityType(activity.activityType)) {
    return { promoted: false };
  }

  if (activity.ingestionStatus === "INELIGIBLE") {
    return { promoted: false };
  }

  const existing = await prisma.workouts.findFirst({
    where: { matchedActivityId: activity.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: "MATCHED" },
    });
    return { promoted: true, workoutId: existing.id, alreadyLinked: true };
  }

  const summaryBlob =
    activity.summaryData != null && typeof activity.summaryData === "object"
      ? (activity.summaryData as Record<string, unknown>)
      : null;
  const activityYmd = activityLocalYmdFromSummary(activity.startTime, summaryBlob);
  const { start, end } = activityMatchCandidateUtcRange(activityYmd);

  if (activityNameHasPushedWorkoutMarker(activity.activityName)) {
    console.warn("⚠️ not promoting pushed Garmin workout activity to standalone ghost", {
      athleteActivityId,
      activityName: activity.activityName,
      activityYmd,
    });
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: "UNMATCHED" },
    });
    return { promoted: false, blockedByPlannedWorkout: true };
  }

  const plannedNearby = await prisma.planned_workouts.findMany({
    where: {
      athleteId: activity.athleteId,
      date: { gte: start, lt: end },
    },
    select: {
      id: true,
      title: true,
      weekNumber: true,
      date: true,
      estimatedDistanceInMeters: true,
      workoutType: true,
      dayAssigned: true,
      planId: true,
      workout_catalogue: { select: { name: true } },
    },
  });

  const availablePlanned = [];
  for (const planned of plannedNearby) {
    const consumed = await plannedDayConsumedByOtherActivity({
      plannedWorkoutId: planned.id,
      activityId: activity.id,
    });
    if (!consumed) {
      availablePlanned.push(planned);
    }
  }

  const activityInput = {
    id: activity.id,
    activityName: activity.activityName,
    activityType: activity.activityType,
    startTime: activity.startTime,
    duration: activity.duration,
    distance: activity.distance,
    averageSpeed: activity.averageSpeed,
    ingestionStatus: activity.ingestionStatus,
    summaryData: activity.summaryData,
    matchedWorkoutId: null,
    matchedWorkoutTitle: null,
  };

  const plausiblePlanned = availablePlanned
    .map((planned) =>
      scoreActivityCandidateForWorkout({
        workout: {
          ...planned,
          catalogueName: planned.workout_catalogue?.name ?? null,
        },
        activity: activityInput,
      })
    )
    .filter(
      (scored): scored is ScoredActivityCandidate =>
        scored != null && isPlausiblePlannedWorkoutNearby({ scored })
    );

  if (plausiblePlanned.length > 0) {
    console.warn("⚠️ not promoting Garmin activity; plausible planned workout nearby", {
      athleteActivityId,
      activityName: activity.activityName,
      activityYmd,
      candidatePlannedWorkoutIds: plausiblePlanned.map((row) => row.id),
    });
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: "UNMATCHED" },
    });
    return { promoted: false, blockedByPlannedWorkout: true };
  }

  const titleBase = (activity.activityName ?? "Recorded run").trim().slice(0, 200);
  const title = titleBase.length > 0 ? titleBase : "Recorded run";
  const distanceMeters =
    activity.distance != null && activity.distance > 0 ? activity.distance : null;
  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);

  const created = await prisma.workouts.create({
    data: {
      title,
      workoutType: "Easy",
      description: null,
      athleteId: activity.athleteId,
      planId: null,
      date: activity.startTime,
      catalogueWorkoutId: null,
      matchedActivityId: activity.id,
      estimatedDistanceInMeters: distanceMeters,
      actualDistanceMeters: distanceMeters,
      actualAvgPaceSecPerMile: paceSecPerMile,
      actualAverageHeartRate: activity.averageHeartRate,
      actualDurationSeconds: activity.duration,
      actualMaxHeartRate: activity.maxHeartRate,
      actualElevationGain: activity.elevationGain,
      actualCalories: activity.calories,
      actualSteps: activity.steps,
      completedActivitySummaryJson:
        summaryBlob != null ? (summaryBlob as object) : undefined,
    },
  });

  await prisma.athlete_activities.update({
    where: { id: athleteActivityId },
    data: { ingestionStatus: "MATCHED" },
  });

  if (
    activity.averageHeartRate != null &&
    Number.isFinite(activity.averageHeartRate) &&
    activity.averageHeartRate >= 80 &&
    activity.averageHeartRate <= 210
  ) {
    try {
      await applyAerobicCeilingCredit({
        athleteId: activity.athleteId,
        creditedAerobicCeilingBpm: Math.round(activity.averageHeartRate),
        planId: null,
        weekNumber: null,
        workoutId: created.id,
      });
    } catch (e) {
      console.error("applyAerobicCeilingCredit after promote:", e);
    }
  }

  return { promoted: true, workoutId: created.id };
}
