"use client";

import type { ReactNode } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import ProfileSidebar from "@/components/profile/ProfileSidebar";

export default function ProfileHubShell({ children }: { children: ReactNode }) {
  return (
    <AthleteAppShell>
      <div className="flex w-full max-w-6xl flex-col sm:flex-row">
        <ProfileSidebar />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</div>
      </div>
    </AthleteAppShell>
  );
}
