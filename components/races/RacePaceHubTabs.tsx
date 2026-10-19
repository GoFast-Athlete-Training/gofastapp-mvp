"use client";

import { useCallback, useMemo, useState } from "react";
import api from "@/lib/api";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { InlineGoalForm } from "@/components/races/InlineGoalForm";
import { RacePaceTargetsSection } from "@/components/races/RacePaceTargetsSection";
import { deriveGoalPaces, normalizeDistanceForPace } from "@/lib/pace-utils";
import { RACE_DISTANCES_MILES } from "@/lib/workout-generator/pace-calculator";
import { resolveMyRacePlannerDistance } from "@/lib/races/myrace-planner-distance";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import {
  buildGuidedRaceStretches,
  type CourseSegmentInput,
} from "@/lib/races/guided-race-plan";
import { goalPaceCheckpoints } from "@/lib/races/goal-pace-checkpoints";
import { guidedStretchesToRacePlanDocument } from "@/lib/races/guided-stretches-to-race-plan";
import { formatFinishClock, parseGoalTimeToSeconds } from "@/lib/training/race-projection";

type Props = {
  raceForGoal: RaceForGoal;
  goal: InlineGoalRow | null;
  courseSegments: CourseSegmentInput[];
  athleteRaceId: string;
  raceDate: string;
  onGoalSaved: (g: InlineGoalRow) => void;
};

type TargetFork = "course" | "custom" | null;

function formatSecPerMile(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function useMyRaceGoalPace(race: RaceForGoal, goal: InlineGoalRow | null) {
  const plannerDistance = useMemo(
    () =>
      resolveMyRacePlannerDistance({
        registryMeters: race.distanceMeters,
        registryLabel: race.distanceLabel,
        raceName: race.name,
      }),
    [race.distanceLabel, race.distanceMeters, race.name]
  );

  const totalMiles = useMemo(() => {
    if (plannerDistance.distanceMeters != null && plannerDistance.distanceMeters > 0) {
      return plannerDistance.distanceMeters / 1609.344;
    }
    const key = normalizeDistanceForPace(plannerDistance.distanceLabel ?? "5k", null);
    return RACE_DISTANCES_MILES[key] ?? RACE_DISTANCES_MILES["5k"];
  }, [plannerDistance.distanceLabel, plannerDistance.distanceMeters]);

  const goalTimeDisplay = goal?.goalTime?.trim() ?? null;

  const goalRacePace = useMemo(() => {
    const gTime = goal?.goalTime?.trim();
    if (!gTime) return null;
    const resolved = resolveGoalRacePace({
      goalTime: gTime,
      dbGoalRacePaceSecPerMile: goal?.goalRacePace ?? null,
      distanceMeters: plannerDistance.distanceMeters ?? race.distanceMeters ?? null,
      distanceLabel: plannerDistance.distanceLabel ?? race.distanceLabel ?? null,
      raceName: race.name,
    });
    if (resolved.goalPaceSecPerMile != null) return resolved.goalPaceSecPerMile;
    try {
      const d = deriveGoalPaces({
        distance: race.distanceLabel ?? "5k",
        goalTime: gTime,
        distanceMiles: totalMiles,
      });
      return d.goalRacePace ?? null;
    } catch {
      return null;
    }
  }, [
    goal?.goalTime,
    goal?.goalRacePace,
    plannerDistance.distanceLabel,
    plannerDistance.distanceMeters,
    race.distanceLabel,
    race.distanceMeters,
    race.name,
    totalMiles,
  ]);

  const goalSec = useMemo(() => {
    if (!goalTimeDisplay) return null;
    return parseGoalTimeToSeconds(goalTimeDisplay);
  }, [goalTimeDisplay]);

  const totalMeters =
    plannerDistance.distanceMeters ?? race.distanceMeters ?? null;

  const checkpoints = useMemo(() => {
    if (goalSec == null || goalSec <= 0) return [];
    return goalPaceCheckpoints({
      goalSec,
      totalMiles,
      totalMeters,
    });
  }, [goalSec, totalMeters, totalMiles]);

  return { goalTimeDisplay, goalRacePace, totalMiles, checkpoints };
}

function CourseSegmentTargetsPanel({
  race,
  goal,
  courseSegments,
  athleteRaceId,
  raceDate,
}: {
  race: RaceForGoal;
  goal: InlineGoalRow;
  courseSegments: CourseSegmentInput[];
  athleteRaceId: string;
  raceDate: string;
}) {
  const { goalTimeDisplay, goalRacePace, totalMiles } = useMyRaceGoalPace(race, goal);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stretches = useMemo(() => {
    if (goalRacePace == null || courseSegments.length === 0) return [];
    return buildGuidedRaceStretches({
      segments: courseSegments,
      totalMiles,
      goalPaceSecPerMi: goalRacePace,
      evenPaceFallback: false,
    });
  }, [courseSegments, goalRacePace, totalMiles]);

  const handleSave = useCallback(async () => {
    if (!goalTimeDisplay || stretches.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const planJson = guidedStretchesToRacePlanDocument({
        goalTimeDisplay,
        stretches,
      });
      await api.post("races/race-plan", {
        athleteRaceId,
        title: race.name?.trim() || "Race plan",
        raceDate,
        planJson,
      });
      setMessage("Race-day plan saved.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  }, [athleteRaceId, goalTimeDisplay, race.name, raceDate, stretches]);

  if (courseSegments.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        This race does not have a course guide on GoFast yet. Use custom targets, or check back
        after the course segments are published.
      </p>
    );
  }

  if (stretches.length === 0) {
    return <p className="text-sm text-gray-600">Set a goal finish time to pace by course segment.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Pacing from your goal and this course&apos;s segments — adjust on race morning if conditions
        change.
      </p>
      <ul className="space-y-2">
        {stretches.map((s) => (
          <li
            key={s.key}
            className="rounded-lg border border-violet-100 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-sm font-bold text-violet-900">{s.title}</p>
            <p className="text-sm text-gray-700 mt-0.5">
              {s.mileRangeLabel} ·{" "}
              <span className="font-semibold tabular-nums">{s.paceBandLabel}</span>
            </p>
            {s.courseNote ? (
              <p className="text-xs text-gray-600 mt-1">{s.courseNote}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save race-day plan"}
        </button>
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </div>
    </div>
  );
}

export function RacePaceHubTabs({
  raceForGoal,
  goal,
  courseSegments,
  athleteRaceId,
  raceDate,
  onGoalSaved,
}: Props) {
  const [targetsExpanded, setTargetsExpanded] = useState(false);
  const [fork, setFork] = useState<TargetFork>(null);

  const { goalTimeDisplay, goalRacePace, checkpoints } = useMyRaceGoalPace(raceForGoal, goal);
  const hasCourseSegments = courseSegments.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-violet-900">Goal</h3>
        <p className="mt-1 text-sm text-gray-600">Finish time — sets the pace you need to hit.</p>
        <div className="mt-3">
          <InlineGoalForm
            race={raceForGoal}
            goal={goal}
            onSaved={onGoalSaved}
            alwaysShowForm
          />
        </div>
      </div>

      {!goalTimeDisplay || goalRacePace == null ? (
        <p className="text-sm text-gray-600">Add a goal finish time to see checkpoints and targets.</p>
      ) : (
        <>
          <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
              Pace you need to hit
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {formatSecPerMile(goalRacePace)}
            </p>
            <p className="text-sm text-gray-600">
              For goal{" "}
              <span className="font-semibold tabular-nums">{goalTimeDisplay}</span>
            </p>
          </div>

          {checkpoints.length > 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Checkpoints (even pace)
              </p>
              <div className="grid grid-cols-3 gap-px bg-gray-100 mt-2">
                {checkpoints.map((cp) => (
                  <div key={cp.label} className="bg-white px-3 py-3 text-center">
                    <p className="text-xs font-semibold text-gray-500">{cp.label}</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900 mt-0.5">
                      {formatFinishClock(cp.elapsedSec)}
                    </p>
                    {cp.label !== "Finish" ? (
                      <p className="text-xs text-gray-500 tabular-nums">{cp.atMi.toFixed(1)} mi</p>
                    ) : (
                      <p className="text-xs text-gray-500 tabular-nums">{cp.atMi.toFixed(1)} mi</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!targetsExpanded ? (
            <button
              type="button"
              onClick={() => setTargetsExpanded(true)}
              className="w-full rounded-lg border border-violet-300 bg-white px-4 py-3 text-sm font-semibold text-violet-900 hover:bg-violet-50"
            >
              Set mile-by-mile targets
            </button>
          ) : (
            <div className="rounded-lg border border-violet-200 bg-white p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Mile-by-mile targets</p>
                <button
                  type="button"
                  onClick={() => {
                    setTargetsExpanded(false);
                    setFork(null);
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>

              {fork == null ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setFork("course")}
                    className="flex-1 rounded-lg border border-violet-300 px-4 py-3 text-left hover:bg-violet-50"
                  >
                    <p className="text-sm font-semibold text-violet-900">By course segments</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {hasCourseSegments
                        ? `${courseSegments.length} segments from this course guide`
                        : "No course guide on this race yet"}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFork("custom")}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">Custom</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Set your own mile ranges and pace bands
                    </p>
                  </button>
                </div>
              ) : null}

              {fork === "course" && goal ? (
                <CourseSegmentTargetsPanel
                  race={raceForGoal}
                  goal={goal}
                  courseSegments={courseSegments}
                  athleteRaceId={athleteRaceId}
                  raceDate={raceDate}
                />
              ) : null}

              {fork === "custom" ? (
                <RacePaceTargetsSection
                  embedded
                  racePlanContext={{
                    athleteRaceId,
                    raceDate,
                    title: raceForGoal.name?.trim() || "Race plan",
                  }}
                  raceTitle={raceForGoal.name?.trim() || "Race plan"}
                />
              ) : null}

              {fork != null ? (
                <button
                  type="button"
                  onClick={() => setFork(null)}
                  className="text-xs font-medium text-violet-700 hover:underline"
                >
                  Choose a different approach
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
