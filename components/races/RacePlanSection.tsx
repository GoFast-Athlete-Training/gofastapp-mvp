"use client";

import { useMemo, useState } from "react";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { InlineGoalForm } from "@/components/races/InlineGoalForm";
import { PaceContextCard } from "@/components/athlete/PaceContextCard";
import { deriveGoalPaces, normalizeDistanceForPace } from "@/lib/pace-utils";
import {
  RACE_DISTANCES_MILES,
  parseRaceTimeToSeconds,
} from "@/lib/workout-generator/pace-calculator";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";

export type PacingStrategy = "even" | "negative" | "positive";

function formatSecPerMile(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function formatSplit(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type MileRow = { label: string; lengthMi: number; paceSecPerMi: number; splitSec: number };

function buildMileRows(
  totalMiles: number,
  baseGoalPaceSecPerMi: number,
  strategy: PacingStrategy
): MileRow[] {
  const rows: MileRow[] = [];
  const eps = 1e-6;
  let offset = 0;

  const paceAtMidpoint = (midMi: number) => {
    const half = totalMiles / 2;
    if (strategy === "even") return baseGoalPaceSecPerMi;
    if (strategy === "negative") {
      return midMi < half - eps ? baseGoalPaceSecPerMi * 1.03 : baseGoalPaceSecPerMi * 0.97;
    }
    return midMi < half - eps ? baseGoalPaceSecPerMi * 0.97 : baseGoalPaceSecPerMi * 1.03;
  };

  let full = 0;
  while (offset + eps < totalMiles) {
    const remaining = totalMiles - offset;
    const len = remaining >= 1 ? 1 : remaining;
    const mid = offset + len / 2;
    const pace = paceAtMidpoint(mid);
    const splitSec = pace * len;
    full += 1;
    const isLast = remaining <= 1 + eps;
    const label = isLast && len < 1 - eps ? `Finish (${len.toFixed(2)} mi)` : `Mile ${full}`;
    rows.push({ label, lengthMi: len, paceSecPerMi: pace, splitSec });
    offset += len;
  }

  return rows;
}

type Props = {
  race: RaceForGoal;
  goal: InlineGoalRow | null;
  onGoalSaved: (g: InlineGoalRow) => void;
};

export function RacePlanSection({ race, goal, onGoalSaved }: Props) {
  const [strategy, setStrategy] = useState<PacingStrategy>("even");

  const derived = useMemo(() => {
    const gTime = goal?.goalTime?.trim();
    if (!gTime) return null;
    try {
      return deriveGoalPaces({
        distance: race.distanceLabel ?? "5k",
        goalTime: gTime,
        distanceMiles:
          race.distanceMeters != null && race.distanceMeters > 0
            ? race.distanceMeters / 1609.344
            : null,
      });
    } catch {
      return null;
    }
  }, [goal?.goalTime, race.distanceLabel, race.distanceMeters]);

  const resolvedGoalRacePace = useMemo(() => {
    const gTime = goal?.goalTime?.trim();
    if (!gTime) return null;
    return resolveGoalRacePace({
      goalTime: gTime,
      dbGoalRacePaceSecPerMile: goal?.goalRacePace ?? null,
      distanceMeters: race.distanceMeters ?? null,
      distanceLabel: race.distanceLabel ?? null,
    });
  }, [goal?.goalTime, goal?.goalRacePace, race.distanceLabel, race.distanceMeters]);

  const goalRacePace = resolvedGoalRacePace?.goalPaceSecPerMile ?? null;

  const goalPace5K =
    goal?.goalPace5K != null && goal.goalPace5K > 0
      ? goal.goalPace5K
      : derived?.goalPace5K ?? null;

  const totalMiles = useMemo(() => {
    if (race.distanceMeters != null && race.distanceMeters > 0) {
      return race.distanceMeters / 1609.344;
    }
    const key = normalizeDistanceForPace(race.distanceLabel ?? "5k", null);
    const m = RACE_DISTANCES_MILES[key];
    return m ?? RACE_DISTANCES_MILES["5k"];
  }, [race.distanceLabel, race.distanceMeters]);

  const mileRows = useMemo(() => {
    if (goalRacePace == null || !Number.isFinite(totalMiles) || totalMiles <= 0) return [];
    return buildMileRows(totalMiles, goalRacePace, strategy);
  }, [goalRacePace, totalMiles, strategy]);

  const goalTimeDisplay = goal?.goalTime?.trim() ?? null;
  let goalFinishSec: number | null = null;
  if (goalTimeDisplay) {
    try {
      goalFinishSec = parseRaceTimeToSeconds(goalTimeDisplay);
    } catch {
      goalFinishSec = null;
    }
  }
  const rowsSumSec = mileRows.reduce((a, r) => a + r.splitSec, 0);

  return (
    <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Plan your race</h2>
      <p className="text-sm text-gray-600 mb-4">
        Lock in your goal time, pick a pacing style, and see target splits by mile.
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
        <InlineGoalForm race={race} goal={goal} onSaved={onGoalSaved} />
      </div>

      {!goalTimeDisplay || goalRacePace == null ? (
        <p className="text-sm text-gray-600">
          Add a goal finish time above to generate per-mile targets.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-violet-100 bg-white/80 p-4 mb-4">
            <p className="text-sm text-gray-800">
              <span className="text-gray-600">Goal time: </span>
              <span className="font-semibold">{goalTimeDisplay}</span>
              <span className="text-gray-600"> · avg pace </span>
              <span className="font-semibold">{formatSecPerMile(goalRacePace)}</span>
              {goalFinishSec != null && rowsSumSec > 0 ? (
                <span className="text-gray-500 text-xs block mt-1">
                  Split table sums to ~{formatSplit(rowsSumSec)} (vs goal {goalTimeDisplay})
                </span>
              ) : null}
            </p>
          </div>

          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Pacing strategy
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["even", "Even splits"],
                  ["negative", "Negative split"],
                  ["positive", "Positive split"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStrategy(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                    strategy === id
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-gray-300 bg-white text-gray-800 hover:border-violet-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {strategy === "negative" ? (
              <p className="mt-2 text-xs text-gray-600">
                First half ~3% slower per mile, second half ~3% faster — steady finish.
              </p>
            ) : null}
            {strategy === "positive" ? (
              <p className="mt-2 text-xs text-amber-800">
                Faster start, slower close — harder to execute; use only if you know the course.
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-semibold">Segment</th>
                  <th className="px-3 py-2 font-semibold">Target pace</th>
                  <th className="px-3 py-2 font-semibold">Split</th>
                </tr>
              </thead>
              <tbody>
                {mileRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-900">{row.label}</td>
                    <td className="px-3 py-2 font-medium">{formatSecPerMile(row.paceSecPerMi)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatSplit(row.splitSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-6">
        <PaceContextCard
          variant="standalone"
          goalPace5KSecPerMile={goalPace5K}
          goalTimeLabel={goalTimeDisplay}
          title="Check a recent effort"
        />
      </div>
    </section>
  );
}
