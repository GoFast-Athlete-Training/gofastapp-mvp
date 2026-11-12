"use client";

import type {
  ActivityDerivedLapRow,
  PhaseAwareLapRow,
  WorkoutPerformanceAnalysis,
} from "@/lib/training/workout-performance-analysis";
import {
  formatPaceTargetRangeDisplay,
  formatSignedBandDeltaSec,
} from "@/lib/training/pace-comparison-display";
import { humanizeSegmentTitle } from "@/lib/training/segment-summary";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function hasPrescription(lap: PhaseAwareLapRow): boolean {
  return lap.targetPaceSecPerMile != null && Number.isFinite(lap.targetPaceSecPerMile);
}

function scoredWorkLaps(analysis: WorkoutPerformanceAnalysis | null): PhaseAwareLapRow[] {
  if (!analysis) return [];
  return analysis.phaseAwareLaps.filter(
    (lap) => lap.phase === "work" && hasPrescription(lap)
  );
}

function otherLaps(analysis: WorkoutPerformanceAnalysis | null): PhaseAwareLapRow[] {
  if (!analysis) return [];
  return analysis.phaseAwareLaps.filter(
    (lap) => lap.phase !== "work" || !hasPrescription(lap)
  );
}

function hasLapPaceDeltas(analysis: WorkoutPerformanceAnalysis | null): boolean {
  if (!analysis) return false;
  if ((analysis.activityDerivedLaps?.length ?? 0) > 0) return true;
  return scoredWorkLaps(analysis).some((lap) => lap.paceSecPerMile != null);
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

function WorkSplitRow({
  lap,
  rowTitle,
}: {
  lap: PhaseAwareLapRow;
  rowTitle: string;
}) {
  const plan =
    formatPaceTargetRangeDisplay(lap.targetPaceSecPerMile, lap.targetPaceSecPerMileHigh) ??
    "OPEN";
  const actual = formatSecPerMile(lap.paceSecPerMile) ?? "—";
  const delta = formatSignedBandDeltaSec(
    lap.paceSecPerMile,
    lap.targetPaceSecPerMile,
    lap.targetPaceSecPerMileHigh
  );

  return (
    <li className="rounded-xl border border-violet-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-gray-900">{rowTitle}</span>
      </div>
      <SplitMetricsGrid plan={plan} actual={actual} delta={delta} />
    </li>
  );
}

function SplitMetricsGrid({
  plan,
  actual,
  delta,
}: {
  plan: string;
  actual: string;
  delta: string;
}) {
  const deltaClass =
    delta.startsWith("+") && delta !== "+0s"
      ? "text-emerald-800"
      : delta.startsWith("-")
        ? "text-amber-900"
        : "text-gray-700";

  return (
    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs sm:text-sm">
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Plan</dt>
        <dd className="mt-0.5 tabular-nums font-medium text-gray-800">{plan}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Actual</dt>
        <dd className="mt-0.5 tabular-nums font-medium text-gray-900">{actual}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Δ</dt>
        <dd className={`mt-0.5 tabular-nums font-semibold ${deltaClass}`}>{delta}</dd>
      </div>
    </dl>
  );
}

function OtherLapLine({ lap }: { lap: PhaseAwareLapRow }) {
  const title =
    lap.phase === "recovery"
      ? "Recovery"
      : lap.phase === "warmup"
        ? "Warm-up"
        : lap.phase === "cooldown"
          ? "Cool-down"
          : lap.segmentTitle?.trim() || "Other";
  const actual = formatSecPerMile(lap.paceSecPerMile) ?? "—";
  return (
    <li className="flex justify-between gap-3 text-xs text-gray-600 tabular-nums">
      <span>{title}</span>
      <span>{actual}</span>
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
  const workLaps = scoredWorkLaps(performanceAnalysis);
  const other = otherLaps(performanceAnalysis);
  const garminLaps = performanceAnalysis?.activityDerivedLaps ?? [];
  const showGarminLaps = garminLaps.length > 0 && workLaps.length === 0;
  const available = hasLapPaceDeltas(performanceAnalysis);

  if (!garminDetailActivityId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Link a Garmin activity to see your splits.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-900">Work rep splits</p>

      {available ? (
        <>
          <p className="mt-2 text-sm text-violet-950">
            {showGarminLaps
              ? "Laps from your Garmin activity file."
              : "Prescribed vs actual pace on work reps only (recovery and warm-up not scored)."}
          </p>
          <ul className="mt-4 space-y-3">
            {showGarminLaps
              ? garminLaps.map((lap) => (
                  <GarminLapSplitBar key={`lap-${lap.lapIndex}`} lap={lap} />
                ))
              : (() => {
                  let workOrdinal = 0;
                  return workLaps.map((lap) => {
                    const title = splitRowTitle(lap, workoutType, workOrdinal++);
                    return (
                      <WorkSplitRow
                        key={`${lap.segmentId}-${lap.lapIndex}`}
                        lap={lap}
                        rowTitle={title}
                      />
                    );
                  });
                })()}
          </ul>
          {!showGarminLaps && other.length > 0 ? (
            <div className="mt-4 border-t border-violet-200/80 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/80">
                {other.length} other lap{other.length === 1 ? "" : "s"} (not scored)
              </p>
              <ul className="mt-2 space-y-1">
                {other.map((lap) => (
                  <OtherLapLine key={`other-${lap.segmentId}-${lap.lapIndex}`} lap={lap} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-violet-900/90">
          Splits aren&apos;t available for this run.
        </p>
      )}
    </div>
  );
}
