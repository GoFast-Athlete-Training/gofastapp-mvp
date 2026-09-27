"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { InlineGoalForm } from "@/components/races/InlineGoalForm";
import { PaceContextCard } from "@/components/athlete/PaceContextCard";
import { deriveGoalPaces, normalizeDistanceForPace } from "@/lib/pace-utils";
import {
  RACE_DISTANCES_MILES,
  parseRaceTimeToSeconds,
} from "@/lib/workout-generator/pace-calculator";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import { formatFinishClock } from "@/lib/training/race-projection";
import {
  raceBlocksToRaceDaySegments,
  suggestRaceBlocksFromGoal,
  type PacingStrategy,
  type RacePacingBlock,
} from "@/lib/races/race-pacing-blocks";

export type { PacingStrategy };

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

function formatPaceBand(low: number, high: number): string {
  if (Math.abs(low - high) < 2) return formatSecPerMile(low);
  return `${formatSecPerMile(low)} – ${formatSecPerMile(high)}`;
}

function blockSplitSec(b: RacePacingBlock): number {
  const mid = (b.paceSecPerMiLow + b.paceSecPerMiHigh) / 2;
  return mid * b.miles;
}

function elapsedAtMile(blocks: RacePacingBlock[], atMi: number): number {
  let cum = 0;
  let sec = 0;
  for (const b of blocks) {
    if (cum + b.miles >= atMi - 1e-6) {
      const slice = atMi - cum;
      const mid = (b.paceSecPerMiLow + b.paceSecPerMiHigh) / 2;
      return sec + mid * slice;
    }
    sec += blockSplitSec(b);
    cum += b.miles;
  }
  return sec;
}

function checkpointLabels(totalMiles: number, blocks: RacePacingBlock[]) {
  const targets: Array<{ label: string; atMi: number }> = [
    { label: "5K", atMi: 3.1 },
    { label: "10K", atMi: 6.2 },
    { label: "Half", atMi: 13.1 },
  ].filter((t) => t.atMi <= totalMiles + 0.05);
  if (totalMiles > 13.5) {
    targets.push({ label: "Finish", atMi: totalMiles });
  }
  return targets.map((t) => ({
    ...t,
    elapsedSec: elapsedAtMile(blocks, t.atMi),
  }));
}

function PaceAdjustForm({
  race,
  goal,
  totalMiles,
  paceSec,
  onSaved,
}: {
  race: RaceForGoal;
  goal: InlineGoalRow | null;
  totalMiles: number;
  paceSec: number | null;
  onSaved: (g: InlineGoalRow) => void;
}) {
  const [min, setMin] = useState(paceSec != null ? String(Math.floor(paceSec / 60)) : "");
  const [sec, setSec] = useState(
    paceSec != null ? String(Math.round(paceSec % 60)).padStart(2, "0") : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paceSec == null) return;
    setMin(String(Math.floor(paceSec / 60)));
    setSec(String(Math.round(paceSec % 60)).padStart(2, "0"));
  }, [paceSec]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(min);
    const s = Number(sec);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59 || m * 60 + s <= 0) {
      setError("Enter pace as minutes and seconds per mile.");
      return;
    }
    if (!Number.isFinite(totalMiles) || totalMiles <= 0) {
      setError("Race distance is missing, so pace cannot set a finish time.");
      return;
    }
    const pace = m * 60 + s;
    const goalTime = formatFinishClock(pace * totalMiles);
    setSaving(true);
    setError(null);
    try {
      const payload = {
        goalTime,
        athleteRaceId: race.athleteRaceId,
        name: race.name,
        distance: race.distanceLabel ?? undefined,
        targetByDate: race.raceDate,
      };
      const saved = goal?.id
        ? (await api.put<{ goal: InlineGoalRow }>(`/goals/${goal.id}`, payload)).data.goal
        : (await api.post<{ goal: InlineGoalRow }>(`/goals`, payload)).data.goal;
      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-violet-100 bg-white p-4 mb-4">
      <p className="text-xs text-gray-600 mb-2">
        Minutes and seconds per mile. Saving updates your finish goal to match.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-500">
          Min
          <input
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="mt-1 block w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
          />
        </label>
        <span className="pb-2 text-gray-400">:</span>
        <label className="text-xs text-gray-500">
          Sec
          <input
            inputMode="numeric"
            value={sec}
            onChange={(e) => setSec(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="mt-1 block w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
          />
        </label>
        <span className="pb-2 text-sm text-gray-600">/mi</span>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Update pace"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </form>
  );
}

type Props = {
  race: RaceForGoal;
  goal: InlineGoalRow | null;
  onGoalSaved: (g: InlineGoalRow) => void;
  /** Parent renders goal in a separate block. */
  hideGoalForm?: boolean;
  /** Render inside My Race Hub without duplicate page chrome. */
  embedded?: boolean;
  /** When set, save coarse blocks to the plan race-day workout. */
  raceDayApply?: { planId: string; dateKey: string; title?: string };
};

export function RacePlanSection({
  race,
  goal,
  onGoalSaved,
  hideGoalForm,
  embedded,
  raceDayApply,
}: Props) {
  const [strategy, setStrategy] = useState<PacingStrategy>("even");
  const [applyingBlocks, setApplyingBlocks] = useState(false);
  const [applyBlocksMessage, setApplyBlocksMessage] = useState<string | null>(null);

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

  const goalRacePace =
    resolvedGoalRacePace?.goalPaceSecPerMile ??
    (goal?.goalRacePace != null && goal.goalRacePace > 0 ? goal.goalRacePace : null);

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

  const pacingBlocks = useMemo(() => {
    if (goalRacePace == null || !Number.isFinite(totalMiles) || totalMiles <= 0) return [];
    return suggestRaceBlocksFromGoal({
      totalMiles,
      goalPaceSecPerMi: goalRacePace,
      strategy,
    });
  }, [goalRacePace, totalMiles, strategy]);

  const checkpoints = useMemo(
    () => (pacingBlocks.length ? checkpointLabels(totalMiles, pacingBlocks) : []),
    [pacingBlocks, totalMiles]
  );

  const goalTimeDisplay = goal?.goalTime?.trim() ?? null;
  let goalFinishSec: number | null = null;
  if (goalTimeDisplay) {
    try {
      goalFinishSec = parseRaceTimeToSeconds(goalTimeDisplay);
    } catch {
      goalFinishSec = null;
    }
  }
  const rowsSumSec = pacingBlocks.reduce((a, r) => a + blockSplitSec(r), 0);

  async function handleApplyBlocksToRaceDay() {
    if (!raceDayApply || pacingBlocks.length === 0) return;
    setApplyingBlocks(true);
    setApplyBlocksMessage(null);
    try {
      const segments = raceBlocksToRaceDaySegments(pacingBlocks);
      await api.post("training/race-day", {
        planId: raceDayApply.planId,
        date: raceDayApply.dateKey,
        title: raceDayApply.title?.trim() || race.name,
        segments,
      });
      setApplyBlocksMessage("Pace blocks saved on your race-day plan.");
    } catch (err: unknown) {
      setApplyBlocksMessage(err instanceof Error ? err.message : "Could not save blocks.");
    } finally {
      setApplyingBlocks(false);
    }
  }

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded
    ? ""
    : "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm mb-6";

  return (
    <Wrapper className={wrapperClass}>
      {!embedded ? (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Plan your race</h2>
          <p className="text-sm text-gray-600 mb-4">
            Lock in your goal time, pick a pacing style, and review a few coarse pacing blocks.
          </p>
        </>
      ) : null}

      {hideGoalForm ? null : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
          <InlineGoalForm race={race} goal={goal} onSaved={onGoalSaved} />
        </div>
      )}

      {goalRacePace != null ? (
        <PaceAdjustForm
          race={race}
          goal={goal}
          totalMiles={totalMiles}
          paceSec={goalRacePace}
          onSaved={onGoalSaved}
        />
      ) : null}

      {goalRacePace == null && !goalTimeDisplay ? (
        <p className="text-sm text-gray-600">
          Add a goal finish time in Your goal to generate pacing blocks and adjust pace.
        </p>
      ) : goalRacePace == null ? (
        <p className="text-sm text-gray-600">
          Save your goal finish time to calculate pace and blocks for this distance.
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
                  Blocks sum to ~{formatSplit(rowsSumSec)} (vs goal {goalTimeDisplay})
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
                First half of the race ~3% slower, second half ~3% faster — steady finish.
              </p>
            ) : null}
            {strategy === "positive" ? (
              <p className="mt-2 text-xs text-amber-800">
                Faster start, slower close — harder to execute; use only if you know the course.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {pacingBlocks.map((block) => (
              <div
                key={block.name}
                className="rounded-lg border border-violet-100 bg-white px-4 py-3 shadow-sm"
              >
                <p className="font-semibold text-gray-900">{block.name}</p>
                <p className="mt-1 text-sm text-gray-700">
                  {block.miles.toFixed(2)} mi · {formatPaceBand(block.paceSecPerMiLow, block.paceSecPerMiHigh)}
                  <span className="text-gray-500">
                    {" "}
                    · ~{formatSplit(blockSplitSec(block))}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {checkpoints.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white/80">
              <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Checkpoints (estimate)
              </p>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-semibold">Mark</th>
                    <th className="px-3 py-2 font-semibold">Miles</th>
                    <th className="px-3 py-2 font-semibold">Est. elapsed</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => (
                    <tr key={cp.label} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{cp.label}</td>
                      <td className="px-3 py-2 text-gray-700">{cp.atMi.toFixed(1)}</td>
                      <td className="px-3 py-2 text-gray-700">{formatSplit(cp.elapsedSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {raceDayApply ? (
            <div className="mt-4">
              <button
                type="button"
                disabled={applyingBlocks || pacingBlocks.length === 0}
                onClick={() => void handleApplyBlocksToRaceDay()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {applyingBlocks ? "Saving…" : "Use these blocks in race plan"}
              </button>
              {applyBlocksMessage ? (
                <p className="mt-2 text-sm text-gray-700">{applyBlocksMessage}</p>
              ) : null}
            </div>
          ) : null}
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
    </Wrapper>
  );
}
