export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  computeWorkoutPerformanceAnalysis,
  type PerformanceAnalysisWorkoutInput,
} from "@/lib/training/workout-performance-analysis";
import {
  derivePaceForPaceStatus,
  paceForPaceStatusLabel,
} from "@/lib/training/pace-for-pace-status";

const METERS_PER_MILE = 1609.34;

function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(METERS_PER_MILE / mps);
}

/**
 * GET /api/performance/history?limit=30
 * Recent matched workouts with explicit Pace for Pace state for observability.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limitRaw = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "30", 10) || 30, 1), 100);

  const rows = await prisma.workouts.findMany({
    where: {
      athleteId: auth.athlete.id,
      matchedActivityId: { not: null },
    },
    include: {
      segments: {
        orderBy: { stepOrder: "asc" },
        include: { segment_laps: { orderBy: { lapIndex: "asc" } } },
      },
      matched_activity: {
        select: {
          id: true,
          activityName: true,
          startTime: true,
          distance: true,
          duration: true,
          averageSpeed: true,
          averageHeartRate: true,
          detailData: true,
          hydratedAt: true,
          ingestionStatus: true,
        },
      },
      training_plans: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const byType = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byType.get(row.workoutType) ?? [];
    list.push(row);
    byType.set(row.workoutType, list);
  }

  const items = rows.map((w, index) => {
    const analysisInput: PerformanceAnalysisWorkoutInput = {
      workoutType: w.workoutType,
      targetPaceSecPerMile: w.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: w.targetPaceSecPerMileHigh,
      paceDeltaSecPerMile: w.paceDeltaSecPerMile,
      actualAvgPaceSecPerMile: w.actualAvgPaceSecPerMile,
      actualDistanceMeters: w.actualDistanceMeters,
      actualDurationSeconds: w.actualDurationSeconds,
      estimatedDistanceInMeters: w.estimatedDistanceInMeters,
      completedActivityDetailJson: w.completedActivityDetailJson,
      matchedActivityId: w.matchedActivityId,
      matched_activity: w.matched_activity,
      segmentExecutionStatus: w.segmentExecutionStatus,
      segmentExecutionLapCount: w.segmentExecutionLapCount,
      segmentExecutionSegmentCount: w.segmentExecutionSegmentCount,
      segments: w.segments.map((s) => ({
        id: s.id,
        title: s.title,
        stepOrder: s.stepOrder,
        targets: s.targets,
        paceTargetEncodingVersion: s.paceTargetEncodingVersion,
        actualPaceSecPerMile: s.actualPaceSecPerMile,
        actualDurationSeconds: s.actualDurationSeconds,
        actualDistanceMiles: s.actualDistanceMiles,
        segment_laps: s.segment_laps,
      })),
    };

    const performanceAnalysis = computeWorkoutPerformanceAnalysis(analysisInput);
    const statusResult = derivePaceForPaceStatus(analysisInput, performanceAnalysis);

    const sameTypeRows = byType.get(w.workoutType) ?? [];
    const priorSameType = sameTypeRows
      .slice(sameTypeRows.indexOf(w) + 1)
      .find((r) => r.paceDeltaSecPerMile != null);

    const activity = w.matched_activity;
    const dateIso =
      w.date?.toISOString() ??
      activity?.startTime?.toISOString() ??
      null;

    return {
      id: w.id,
      activityId: w.matchedActivityId,
      title: w.title,
      workoutType: w.workoutType,
      planName: w.training_plans?.name ?? null,
      date: dateIso,
      activityName: activity?.activityName ?? null,
      ingestionStatus: activity?.ingestionStatus ?? null,
      distanceMeters: w.actualDistanceMeters ?? activity?.distance ?? null,
      durationSeconds: w.actualDurationSeconds ?? activity?.duration ?? null,
      avgPaceSecPerMile:
        w.actualAvgPaceSecPerMile ?? speedMpsToSecPerMile(activity?.averageSpeed),
      avgHeartRate: w.actualAverageHeartRate ?? activity?.averageHeartRate ?? null,
      plannedDistanceMeters: w.estimatedDistanceInMeters,
      paceDeltaSecPerMile: w.paceDeltaSecPerMile,
      segmentExecutionStatus: w.segmentExecutionStatus,
      executionHeadline: performanceAnalysis.executionHeadline,
      paceForPaceStatus: statusResult.status,
      paceForPaceStatusLabel: paceForPaceStatusLabel(statusResult.status),
      paceForPaceMessage: statusResult.message,
      priorSameTypePaceDeltaSecPerMile: priorSameType?.paceDeltaSecPerMile ?? null,
      index,
    };
  });

  return NextResponse.json({ items, total: items.length });
}
