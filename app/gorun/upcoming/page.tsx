"use client";

import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import GoRunUpcomingRunsPanel from "@/components/runs/GoRunUpcomingRunsPanel";

export default function GoRunUpcomingRunsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Link href="/gorun" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              ← Back to Run
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Upcoming</h1>
            <p className="text-sm text-gray-600">Your standalone runs and meetups.</p>
            <GoRunUpcomingRunsPanel mode="full" />
          </div>
        </main>
      </div>
    </div>
  );
}
