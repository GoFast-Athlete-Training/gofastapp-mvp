"use client";

import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import GoalSetter from "@/components/athlete/GoalSetter";

export default function GoalsPage() {
  return (
    <AthleteAppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <GoalSetter />
      </div>
    </AthleteAppShell>
  );
}
