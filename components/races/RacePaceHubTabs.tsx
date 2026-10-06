"use client";

import Link from "next/link";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { GuidedRacePlanSection } from "@/components/races/GuidedRacePlanSection";
import type { CourseSegmentInput } from "@/lib/races/guided-race-plan";

type Props = {
  raceForGoal: RaceForGoal;
  goal: InlineGoalRow | null;
  courseSegments: CourseSegmentInput[];
  /** When false, show training plan CTA instead of race-week pacing. */
  showRaceWeekPlan: boolean;
  hasPlanForRace: boolean;
  trainingPlanId: string | null;
  activePlanHasSchedule: boolean;
  athleteRaceId: string;
};

export function RacePaceHubTabs({
  raceForGoal,
  goal,
  courseSegments,
  showRaceWeekPlan,
  hasPlanForRace,
  trainingPlanId,
  activePlanHasSchedule,
  athleteRaceId,
}: Props) {
  if (!showRaceWeekPlan) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">
          Training plan
        </h3>
        <p className="text-sm text-gray-600">
          Your race is more than a week out. Build your weekly schedule here — race-week pacing unlocks
          seven days before {raceForGoal.name}.
        </p>
        {hasPlanForRace && trainingPlanId ? (
          <Link
            href={activePlanHasSchedule ? "/training" : `/training-setup/${encodeURIComponent(trainingPlanId)}`}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {activePlanHasSchedule ? "Open training hub" : "Finish plan setup"}
          </Link>
        ) : (
          <Link
            href={`/training-setup?athleteRaceId=${encodeURIComponent(athleteRaceId)}`}
            className="inline-flex rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Add a training plan
          </Link>
        )}
      </div>
    );
  }

  return (
    <GuidedRacePlanSection race={raceForGoal} goal={goal} courseSegments={courseSegments} />
  );
}
