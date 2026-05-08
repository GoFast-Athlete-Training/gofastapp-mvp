"use client";

import type { ReactNode } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";

export default function RacesHubShell({ children }: { children: ReactNode }) {
  return (
    <AthleteAppShell>
      <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    </AthleteAppShell>
  );
}
