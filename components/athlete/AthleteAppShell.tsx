"use client";

import type { ReactNode } from "react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { ATHLETE_MOBILE_NAV_CONTENT_PAD } from "@/components/athlete/AthleteMobileNav";

export default function AthleteAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className={`flex-1 overflow-y-auto min-w-0 ${ATHLETE_MOBILE_NAV_CONTENT_PAD}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
