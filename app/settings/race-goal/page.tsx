"use client";

import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import RaceGoalEditor from "@/components/athlete/RaceGoalEditor";

export default function RaceGoalPage() {
  return (
    <AthleteAppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <RaceGoalEditor variant="settings" />
      </div>
    </AthleteAppShell>
  );
}
