"use client";

import { useMemo, useState } from "react";
import { equivalent5KPaceSecondsPerMile, metersToMiles } from "@/lib/pace-utils";
import { RACE_DISTANCES_MILES } from "@/lib/workout-generator/pace-calculator";

const MILES_5K = RACE_DISTANCES_MILES["5k"] ?? 3.10686;

function formatSecPerMile(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function formatRaceClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "—";
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function paceInsightVerdict(gapSecPerMile: number): string {
  if (gapSecPerMile < 0) return "Ahead of goal pace — looking strong.";
  if (gapSecPerMile <= 20) return "Right on target.";
  if (gapSecPerMile <= 60) return "Getting close to goal pace.";
  return "Building your base — keep the work going.";
}

export type PaceContextFromActivity = {
  distanceMeters: number;
  durationSeconds: number;
};

export type PaceContextCardProps = {
  variant?: "embedded" | "standalone";
  /** When set, projections compare to this seconds-per-mile (equivalent 5K pace). */
  goalPace5KSecPerMile: number | null | undefined;
  goalTimeLabel?: string | null;
  fromActivity?: PaceContextFromActivity | null;
  title?: string;
};

function computeContext(
  distanceMiles: number,
  durationSec: number,
  goalPace5KSecPerMile: number | null | undefined
) {
  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles <= 0 ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0
  ) {
    return null;
  }

  const avgPaceSecPerMile = durationSec / distanceMiles;
  const projected5KFinishSec = durationSec * Math.pow(MILES_5K / distanceMiles, 1.06);
  const projected5KPaceSecPerMile = equivalent5KPaceSecondsPerMile(
    durationSec,
    distanceMiles
  );

  let gapSec: number | null = null;
  let verdict: string | null = null;
  if (
    goalPace5KSecPerMile != null &&
    Number.isFinite(goalPace5KSecPerMile) &&
    goalPace5KSecPerMile > 0
  ) {
    gapSec = projected5KPaceSecPerMile - goalPace5KSecPerMile;
    verdict = paceInsightVerdict(gapSec);
  }

  return {
    avgPaceSecPerMile,
    projected5KFinishSec,
    projected5KPaceSecPerMile,
    gapSec,
    verdict,
  };
}

export function PaceContextCard({
  variant = "standalone",
  goalPace5KSecPerMile,
  goalTimeLabel,
  fromActivity,
  title = "How did this run compare to your goal?",
}: PaceContextCardProps) {
  const [distMi, setDistMi] = useState("");
  const [durMin, setDurMin] = useState("");
  const [durSec, setDurSec] = useState("");

  const resolved = useMemo(() => {
    if (fromActivity?.distanceMeters && fromActivity.durationSeconds) {
      const mi = metersToMiles(fromActivity.distanceMeters);
      return computeContext(
        mi,
        fromActivity.durationSeconds,
        goalPace5KSecPerMile
      );
    }
    return null;
  }, [fromActivity, goalPace5KSecPerMile]);

  const manualComputed = useMemo(() => {
    if (variant !== "standalone" || fromActivity) return null;
    const d = parseFloat(distMi.replace(/,/g, ""));
    const mPart = parseInt(durMin, 10);
    const sPart = parseInt(durSec, 10);
    if (!Number.isFinite(d) || d <= 0) return null;
    const m = Number.isFinite(mPart) ? mPart : 0;
    const s = Number.isFinite(sPart) ? sPart : 0;
    const totalSec = m * 60 + s;
    if (totalSec <= 0) return null;
    return computeContext(d, totalSec, goalPace5KSecPerMile);
  }, [variant, fromActivity, distMi, durMin, durSec, goalPace5KSecPerMile]);

  const ctx = resolved ?? manualComputed;

  if (variant === "embedded" && fromActivity && !ctx) {
    return null;
  }

  const shell =
    variant === "embedded"
      ? "rounded-lg border border-slate-200 bg-slate-50/90 p-4"
      : "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";

  return (
    <div className={shell}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>

      {variant === "standalone" && !fromActivity ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <label className="block">
            <span className="text-gray-600 text-xs">Distance (mi)</span>
            <input
              type="text"
              inputMode="decimal"
              value={distMi}
              onChange={(e) => setDistMi(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-gray-600 text-xs">Minutes</span>
            <input
              type="number"
              min={0}
              value={durMin}
              onChange={(e) => setDurMin(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-gray-600 text-xs">Seconds</span>
            <input
              type="number"
              min={0}
              max={59}
              value={durSec}
              onChange={(e) => setDurSec(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>
        </div>
      ) : null}

      {!ctx ? (
        <p className="mt-2 text-sm text-gray-600">
          {variant === "standalone" && !fromActivity
            ? "Enter distance and time to see an equivalent 5K and how it stacks up to your goal."
            : "Need distance and duration to compare this run to your goal."}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-gray-800">
          <li>
            <span className="text-gray-600">Avg pace: </span>
            <span className="font-semibold">{formatSecPerMile(ctx.avgPaceSecPerMile)}</span>
          </li>
          <li>
            <span className="text-gray-600">Projected 5K (same effort): </span>
            <span className="font-semibold">{formatRaceClock(ctx.projected5KFinishSec)}</span>
            <span className="text-gray-600">
              {" "}
              ({formatSecPerMile(ctx.projected5KPaceSecPerMile)} avg)
            </span>
          </li>
          {goalPace5KSecPerMile != null &&
          Number.isFinite(goalPace5KSecPerMile) &&
          goalPace5KSecPerMile > 0 ? (
            <>
              <li>
                <span className="text-gray-600">Your goal 5K pace: </span>
                <span className="font-semibold">{formatSecPerMile(goalPace5KSecPerMile)}</span>
                {goalTimeLabel?.trim() ? (
                  <span className="text-gray-600"> ({goalTimeLabel.trim()} goal)</span>
                ) : null}
              </li>
              {ctx.gapSec != null && ctx.verdict ? (
                <li className="pt-1 text-gray-900 font-medium">{ctx.verdict}</li>
              ) : null}
            </>
          ) : (
            <li className="text-gray-600 pt-1">
              Set a race goal with a target time to see how this effort compares.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
