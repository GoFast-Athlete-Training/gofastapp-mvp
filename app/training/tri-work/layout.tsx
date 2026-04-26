"use client";

import type { ReactNode } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import TriWorkSubNav, { TriWorkSubNavMobile } from "@/components/training/TriWorkSubNav";

export default function TriWorkLayout({ children }: { children: ReactNode }) {
  return (
    <AthleteAppShell>
      <div className="flex w-full min-h-0 flex-1">
        <TriWorkSubNav />
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="sm:hidden px-4 pt-4">
            <TriWorkSubNavMobile />
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">{children}</div>
        </div>
      </div>
    </AthleteAppShell>
  );
}
