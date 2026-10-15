"use client";

import type {
  ActivityDerivedLapRow,
  PhaseAwareLapRow,
  WorkoutPerformanceAnalysis,
} from "@/lib/training/workout-performance-analysis";
import {
  formatPaceTargetRangeDisplay,
  paceRangeDeltaMessage,
  paceRangeBounds,
  paceVsTargetLabel,
} from "@/lib/training/pace-comparison-display";
import { humanizeSegmentTitle } from "@/lib/training/segment-summary";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function lapPaceLabel(lap: PhaseAwareLapRow): string {
  const bandMessage = paceRangeDeltaMessage(
    lap.paceSecPerMile,
    lap.targetPaceSecPerMile,
    lap.targetPaceSecPerMileHigh
  );
  if (bandMessage) return bandMessage;
  if (lap.vsPlanPaceLabel && lap.vsPlanPaceLabel !== "—") return lap.vsPlanPaceLabel;
  return "—";
}

function splitsLaps(analysis: WorkoutPerformanceAnalysis | null): PhaseAwareLapRow[] {
  if (!analysis) return [];
  return analysis.phaseAwareLaps;
}

function hasLapPaceDeltas(analysis: WorkoutPerformanceAnalysis | null): boolean {
  if (!analysis) return false;
  if ((analysis.activityDerivedLaps?.length ?? 0) > 0) return true;
  const laps = analysis.phaseAwareLaps;
  return laps.some(
    (lap) =>
      lap.paceSecPerMile != null ||
      (lap.paceDeltaSecPerMile != null && Number.isFinite(lap.paceDeltaSecPerMile)) ||
      (lap.vsPlanPaceLabel !== "—" && lap.phase === "work")
  );
}

function isGenericWorkTitle(title: string | null | undefined): boolean {
  const t = title?.trim().toLowerCase() ?? "";
  return t === "work" || t === "segment";
}

function splitRowTitle(
  lap: PhaseAwareLapRow,
  workoutType: string | null | undefined,
  workOrdinal: number
): string {
  if (lap.phase === "warmup") return "Warm-up";
  if (lap.phase === "cooldown") return "Cool-down";
  if (lap.phase === "recovery") return "Recovery";
  if (lap.phase === "activity") return "Activity";

  const wt = workoutType?.trim() ?? "";
  if ((wt === "Easy" || wt === "LongRun") && lap.phase === "work") {
    return `Mile ${workOrdinal + 1}`;
  }

  if (isGenericWorkTitle(lap.segmentTitle)) {
    return `Rep ${workOrdinal + 1}`;
  }

  return humanizeSegmentTitle(lap.segmentTitle, workoutType);
}

function paceBarWidthPercent(
  actualSecPerMile: number,
  low: number | null | undefined,
  high: number | null | undefined
): number {
  const b = paceRangeBounds(low, high);
  if (!b) return 24;
  const label = paceVsTargetLabel(actualSecPerMile, low, high);
  if (label === "in_range") return 100;
  if (label === "slower") {
    return Math.min(96, Math.max(14, Math.round((b.hi / actualSecPerMile) * 100)));
  }
  if (label === "faster") return 96;
  return 24;
}

function SplitBar({
  lap,
  rowTitle,
}: {
  lap: PhaseAwareLapRow;
  rowTitle: string;
}) {
  const pace = formatSecPerMile(lap.paceSecPerMile);
  const prescribed =
    lap.targetPaceSecPerMile != null
      ? formatPaceTargetRangeDisplay(lap.targetPaceSecPerMile, lap.targetPaceSecPerMileHigh)
      : "OPEN";
  const label = lapPaceLabel(lap);
  const barWidth =
    lap.paceSecPerMile != null
      ? `${paceBarWidthPercent(
          lap.paceSecPerMile,
          lap.targetPaceSecPerMile,
          lap.targetPaceSecPerMileHigh
        )}%`
      : "24%";

  return (
    <li className="rounded-xl border border-violet-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-gray-900">{rowTitle}</span>
        <span className="tabular-nums text-gray-800">{pace ?? "—"}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-violet-100">
        <div
          className="h-2 rounded-full bg-violet-600 transition-all"
          style={{ width: barWidth }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-600">
        <span>Prescribed: {prescribed ?? "OPEN"}</span>
        <span className="font-medium text-violet-900">{label}</span>
      </div>
    </li>
  );
}

function GarminLapSplitBar({ lap }: { lap: ActivityDerivedLapRow }) {
  const pace = formatSecPerMile(lap.avgPaceSecPerMile);
  const dist =
    lap.distanceMiles != null && lap.distanceMiles > 0
      ? `${lap.distanceMiles.toFixed(2)} mi`
      : "—";
  const time =
    lap.durationSeconds > 0
      ? `${Math.floor(lap.durationSeconds / 60)}:${String(lap.durationSeconds % 60).padStart(2, "0")}`
      : "—";

  return (
    <li className="rounded-xl border border-violet-200 bg-white px-4 py-3">
      <div className="grid grid-cols-5 gap-2 text-sm">
        <span className="font-semibold text-gray-900">Lap {lap.lapIndex + 1}</span>
        <span className="tabular-nums text-gray-800">{time}</span>
        <span className="tabular-nums text-gray-800">{dist}</span>
        <span className="col-span-2 tabular-nums text-gray-800">{pace ?? "—"}</span>
      </div>
    </li>
  );
}

type Props = {
  garminDetailActivityId?: string | null;
  performanceAnalysis: WorkoutPerformanceAnalysis | null;
  workoutType?: string | null;
};

export default function PaceForPacePanel({
  garminDetailActivityId,
  performanceAnalysis,
  workoutType,
}: Props) {
  const available = hasLapPaceDeltas(performanceAnalysis);
  const laps = splitsLaps(performanceAnalysis);
  const garminLaps = performanceAnalysis?.activityDerivedLaps ?? [];
  const showGarminLaps = garminLaps.length > 0 && laps.length === 0;

  if (!garminDetailActivityId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Link a Garmin activity to see your splits.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-900">Your splits</p>

      {available ? (
        <>
          <p className="mt-2 text-sm text-violet-950">
            {showGarminLaps
              ? "Laps from your Garmin activity file."
              : "Prescribed vs actual pace for each lap."}
          </p>
          <ul className="mt-4 space-y-3">
            {showGarminLaps
              ? garminLaps.map((lap) => (
                  <GarminLapSplitBar key={`lap-${lap.lapIndex}`} lap={lap} />
                ))
              : (() => {
                  let workOrdinal = 0;
                  return laps.map((lap) => {
                    const workIndex = lap.phase === "work" ? workOrdinal++ : workOrdinal;
                    const title =
                      lap.phase === "work"
                        ? splitRowTitle(lap, workoutType, workIndex)
                        : splitRowTitle(lap, workoutType, 0);
                    return (
                      <SplitBar
                        key={`${lap.segmentId}-${lap.lapIndex}`}
                        lap={lap}
                        rowTitle={title}
                      />
                    );
                  });
                })()}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-violet-900/90">
          Splits aren&apos;t available for this run.
        </p>
      )}
    </div>
  );
}
