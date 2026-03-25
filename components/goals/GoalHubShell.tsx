"use client";

import type { ReactNode } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import GoalSidebar from "@/components/goals/GoalSidebar";

export default function GoalHubShell({ children }: { children: ReactNode }) {
  return (
    <AthleteAppShell>
      <div className="flex flex-col sm:flex-row flex-1 min-h-0 w-full max-w-6xl mx-auto">
        <GoalSidebar />
        <div className="flex-1 overflow-y-auto min-w-0 px-4 sm:px-6 py-6">{children}</div>
      </div>
    </AthleteAppShell>
  );
}
