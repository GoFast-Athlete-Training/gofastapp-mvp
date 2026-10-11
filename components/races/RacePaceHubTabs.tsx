"use client";

import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { GuidedRacePlanSection } from "@/components/races/GuidedRacePlanSection";
import { RacePlanSection } from "@/components/races/RacePlanSection";
import type { CourseSegmentInput } from "@/lib/races/guided-race-plan";

type Props = {
  raceForGoal: RaceForGoal;
  goal: InlineGoalRow | null;
  courseSegments: CourseSegmentInput[];
  athleteRaceId: string;
  raceDate: string;
  onGoalSaved: (g: InlineGoalRow) => void;
};

export function RacePaceHubTabs({
  raceForGoal,
  goal,
  courseSegments,
  athleteRaceId,
  raceDate,
  onGoalSaved,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900">
          My race-day plan
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Pacing strategy and splits — independent of your training plan.
        </p>
      </div>

      <GuidedRacePlanSection race={raceForGoal} goal={goal} courseSegments={courseSegments} />

      <RacePlanSection
        race={raceForGoal}
        goal={goal}
        onGoalSaved={onGoalSaved}
        hideGoalForm
        embedded
        persistRacePlan={{
          athleteRaceId,
          raceDate,
          title: raceForGoal.name?.trim() || "Race plan",
        }}
      />
    </div>
  );
}
