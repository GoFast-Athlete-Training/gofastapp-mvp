"use client";

import type { ReactNode } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import ProfileSidebar from "@/components/profile/ProfileSidebar";

export default function ProfileHubShell({ children }: { children: ReactNode }) {
  return (
    <AthleteAppShell>
      <div className="flex flex-col sm:flex-row flex-1 min-h-0 w-full max-w-6xl mx-auto">
        <ProfileSidebar />
        <div className="flex-1 overflow-y-auto min-w-0 px-4 sm:px-6 py-6">{children}</div>
      </div>
    </AthleteAppShell>
  );
}
