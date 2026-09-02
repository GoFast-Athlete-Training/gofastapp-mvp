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
import {
  formatPaceTargetRangeDisplay,
  paceVsTargetBadgeText,
  paceVsTargetLabel,
} from "@/lib/training/pace-comparison-display";
import { workoutHasLapPaceDeltas } from "@/lib/training/workout-pace-analyzer";

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
      garminDetailActivityId: { not: null },
    },
    include: {
      segments: {
        orderBy: { stepOrder: "asc" },
        include: { segment_laps: { orderBy: { lapIndex: "asc" } } },
      },
      garmin_detail_activity: {
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
    const activity = w.garmin_detail_activity;
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
      garminDetailActivityId: w.garminDetailActivityId,
      garmin_detail_activity: w.garmin_detail_activity,
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

    const avgPace =
      w.actualAvgPaceSecPerMile ?? speedMpsToSecPerMile(activity?.averageSpeed);
    const prescribedPaceDisplay = formatPaceTargetRangeDisplay(
      w.targetPaceSecPerMile,
      w.targetPaceSecPerMileHigh
    );

    const lapDeltas = w.segments.flatMap((s) =>
      (s.segment_laps ?? [])
        .map((l) => l.paceDeltaSecPerMile)
        .filter((d): d is number => d != null && Number.isFinite(d))
    );
    const avgLapDelta =
      lapDeltas.length > 0
        ? Math.round(lapDeltas.reduce((a, b) => a + b, 0) / lapDeltas.length)
        : null;

    const vsPlanLabel =
      avgLapDelta != null
        ? paceVsTargetLabel(avgPace, w.targetPaceSecPerMile, w.targetPaceSecPerMileHigh)
        : "unknown";
    const vsPlanMessage =
      statusResult.status === "PACE_FOR_PACE_AVAILABLE" && lapDeltas.length > 0
        ? `${lapDeltas.length} split${lapDeltas.length === 1 ? "" : "s"} · avg Δ ${avgLapDelta! > 0 ? "+" : ""}${avgLapDelta}s/mi`
        : statusResult.failureReason ?? statusResult.message;
    const vsPlanBadge =
      statusResult.status === "PACE_FOR_PACE_AVAILABLE"
        ? paceVsTargetBadgeText(vsPlanLabel)
        : statusResult.status === "PACE_FOR_PACE_FAILED"
          ? "Analysis failed"
          : statusResult.status === "MATCHED_ANALYSIS_NOT_GENERATED"
            ? "Needs analysis"
            : paceForPaceStatusLabel(statusResult.status);

    const sameTypeRows = byType.get(w.workoutType) ?? [];
    const priorSameType = sameTypeRows
      .slice(sameTypeRows.indexOf(w) + 1)
      .find((r) =>
        r.segments.some((s) =>
          (s.segment_laps ?? []).some((l) => l.paceDeltaSecPerMile != null)
        )
      );

    const dateIso =
      w.date?.toISOString() ??
      activity?.startTime?.toISOString() ??
      null;

    return {
      id: w.id,
      activityId: w.garminDetailActivityId,
      title: w.title,
      workoutType: w.workoutType,
      planName: w.training_plans?.name ?? null,
      date: dateIso,
      activityName: activity?.activityName ?? null,
      ingestionStatus: activity?.ingestionStatus ?? null,
      distanceMeters: w.actualDistanceMeters ?? activity?.distance ?? null,
      durationSeconds: w.actualDurationSeconds ?? activity?.duration ?? null,
      avgPaceSecPerMile: avgPace,
      avgHeartRate: w.actualAverageHeartRate ?? activity?.averageHeartRate ?? null,
      plannedDistanceMeters: w.estimatedDistanceInMeters,
      targetPaceSecPerMile: w.targetPaceSecPerMile,
      targetPaceSecPerMileHigh: w.targetPaceSecPerMileHigh,
      prescribedPaceDisplay,
      paceDeltaSecPerMile: avgLapDelta,
      hasLapDeltas: workoutHasLapPaceDeltas(w.segments),
      segmentExecutionStatus: w.segmentExecutionStatus,
      segmentComparisonCount: lapDeltas.length,
      executionHeadline: null,
      vsPlanBadge,
      vsPlanMessage:
        statusResult.status === "PACE_FOR_PACE_AVAILABLE"
          ? vsPlanMessage
          : statusResult.failureReason ?? statusResult.message,
      paceForPaceStatus: statusResult.status,
      priorSameTypePaceDeltaSecPerMile:
        priorSameType != null
          ? (() => {
              const deltas = priorSameType.segments.flatMap((s) =>
                (s.segment_laps ?? [])
                  .map((l) => l.paceDeltaSecPerMile)
                  .filter((d): d is number => d != null && Number.isFinite(d))
              );
              return deltas.length > 0
                ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
                : null;
            })()
          : null,
      index,
    };
  });

  return NextResponse.json({ items, total: items.length });
}
