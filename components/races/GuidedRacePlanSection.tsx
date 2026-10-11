"use client";

import { useMemo } from "react";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { deriveGoalPaces, normalizeDistanceForPace } from "@/lib/pace-utils";
import { RACE_DISTANCES_MILES } from "@/lib/workout-generator/pace-calculator";
import { resolveMyRacePlannerDistance } from "@/lib/races/myrace-planner-distance";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import {
  buildGuidedRaceStretches,
  type CourseSegmentInput,
} from "@/lib/races/guided-race-plan";

type Props = {
  race: RaceForGoal;
  goal: InlineGoalRow | null;
  courseSegments: CourseSegmentInput[];
};

function formatSecPerMile(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

export function GuidedRacePlanSection({ race, goal, courseSegments }: Props) {
  const goalTimeDisplay = goal?.goalTime?.trim() ?? null;

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

  const stretches = useMemo(() => {
    if (goalRacePace == null) return [];
    return buildGuidedRaceStretches({
      segments: courseSegments,
      totalMiles,
      goalPaceSecPerMi: goalRacePace,
    });
  }, [courseSegments, goalRacePace, totalMiles]);

  if (!goalTimeDisplay || goalRacePace == null) {
    return (
      <p className="text-sm text-gray-600">
        Set your goal finish time above to see suggested pacing for race week.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900">
          Your race plan
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {courseSegments.length > 0
            ? "Suggested pacing from your goal and this course — tune on race morning if conditions change."
            : "Even-pace targets from your goal — add course segments on GoFast for terrain-aware pacing."}
        </p>
      </div>

      <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3">
        <p className="text-sm text-gray-800">
          Goal <span className="font-semibold tabular-nums">{goalTimeDisplay}</span>
          <span className="text-gray-600"> · avg </span>
          <span className="font-semibold tabular-nums">{formatSecPerMile(goalRacePace)}</span>
        </p>
      </div>

      {stretches.length === 0 ? (
        <p className="text-sm text-gray-600">
          Add a goal finish time to see pacing targets for race day.
        </p>
      ) : (
        <ul className="space-y-3">
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
              <p className="text-xs text-gray-600 mt-1">{s.effortNote}</p>
              {s.courseNote ? (
                <p className="text-sm text-gray-800 mt-2 border-t border-violet-50 pt-2">
                  {s.courseNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-500">
        Garmin race-day steps live on your training calendar for race morning.
      </p>
    </div>
  );
}
