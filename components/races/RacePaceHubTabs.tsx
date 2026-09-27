"use client";

import { useState } from "react";
import type { RaceForGoal, InlineGoalRow } from "@/components/races/InlineGoalForm";
import { RacePlanSection } from "@/components/races/RacePlanSection";
import { RacePaceTargetsSection } from "@/components/races/RacePaceTargetsSection";

type RacePlanContext = {
  athleteRaceId: string;
  raceDate: string;
  planId?: string | null;
  title?: string;
};

type Props = {
  raceForGoal: RaceForGoal;
  goal: InlineGoalRow | null;
  racePlanContext?: RacePlanContext;
  /** Default tab when landing with ?plan=1 */
  defaultTab?: "build" | "outlook";
};

export function RacePaceHubTabs({
  raceForGoal,
  goal,
  racePlanContext,
  defaultTab = "build",
}: Props) {
  const [tab, setTab] = useState<"build" | "outlook">(defaultTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-violet-100 pb-3">
        <button
          type="button"
          onClick={() => setTab("build")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "build"
              ? "bg-violet-600 text-white"
              : "bg-white text-violet-900 border border-violet-200 hover:bg-violet-50"
          }`}
        >
          Build race plan
        </button>
        <button
          type="button"
          onClick={() => setTab("outlook")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "outlook"
              ? "bg-violet-600 text-white"
              : "bg-white text-violet-900 border border-violet-200 hover:bg-violet-50"
          }`}
        >
          See split outlook
        </button>
      </div>

      {tab === "build" ? (
        racePlanContext ? (
          <RacePaceTargetsSection
            raceTitle={raceForGoal.name}
            racePlanContext={racePlanContext}
          />
        ) : (
          <p className="text-sm text-gray-600">
            Sign up for this race on your account to build and save a race plan.
          </p>
        )
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Static estimate from your goal time and pacing strategy — for reference only. It does not
            change your Garmin workout.
          </p>
          <RacePlanSection
            race={raceForGoal}
            goal={goal}
            onGoalSaved={() => {}}
            hideGoalForm
            embedded
            splitOutlookOnly
          />
        </>
      )}
    </div>
  );
}
