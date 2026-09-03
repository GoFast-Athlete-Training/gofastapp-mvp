"use client";

import type {
  PhaseAwareLapRow,
  WorkoutPerformanceAnalysis,
} from "@/lib/training/workout-performance-analysis";
import {
  formatPaceTargetRangeDisplay,
  paceRangeDeltaMessage,
} from "@/lib/training/pace-comparison-display";

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
  const laps = analysis.phaseAwareLaps;
  if (analysis.requiresSegmentLevelPaceForPace) {
    return laps.filter((lap) => lap.phase === "work");
  }
  return laps;
}

function hasLapPaceDeltas(analysis: WorkoutPerformanceAnalysis | null): boolean {
  if (!analysis) return false;
  const laps = splitsLaps(analysis);
  return laps.some(
    (lap) =>
      (lap.paceDeltaSecPerMile != null && Number.isFinite(lap.paceDeltaSecPerMile)) ||
      (lap.vsPlanPaceLabel !== "—" && lap.phase === "work")
  );
}

function phaseLabel(phase: PhaseAwareLapRow["phase"]): string {
  switch (phase) {
    case "warmup":
      return "Warmup";
    case "work":
      return "Work";
    case "recovery":
      return "Recovery";
    case "cooldown":
      return "Cooldown";
  }
}

function SplitBar({ lap }: { lap: PhaseAwareLapRow }) {
  const pace = formatSecPerMile(lap.paceSecPerMile);
  const prescribed =
    lap.targetPaceSecPerMile != null
      ? formatPaceTargetRangeDisplay(lap.targetPaceSecPerMile, lap.targetPaceSecPerMileHigh)
      : "OPEN";
  const label = lapPaceLabel(lap);
  const barWidth =
    lap.paceSecPerMile != null
      ? `${Math.min(100, Math.max(18, 600 / lap.paceSecPerMile))}%`
      : "24%";

  return (
    <li className="rounded-xl border border-violet-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-gray-900">
          {phaseLabel(lap.phase)}
          {lap.segmentTitle ? ` · ${lap.segmentTitle}` : ""}
        </span>
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

type Props = {
  garminDetailActivityId?: string | null;
  performanceAnalysis: WorkoutPerformanceAnalysis | null;
};

export default function PaceForPacePanel({
  garminDetailActivityId,
  performanceAnalysis,
}: Props) {
  const available = hasLapPaceDeltas(performanceAnalysis);
  const laps = splitsLaps(performanceAnalysis);

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
            Prescribed vs actual pace for each lap.
          </p>
          <ul className="mt-4 space-y-3">
            {laps.map((lap) => (
              <SplitBar key={`${lap.segmentId}-${lap.lapIndex}`} lap={lap} />
            ))}
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
