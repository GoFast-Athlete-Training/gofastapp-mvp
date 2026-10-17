"use client";

import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import GoRunUpcomingRunsPanel from "@/components/runs/GoRunUpcomingRunsPanel";

export default function MyRunsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                My runs
              </p>
              <h1 className="text-3xl font-bold text-gray-900 mt-1 mb-2">My runs</h1>
              <p className="text-gray-600">
                City runs you created or joined.{" "}
                <Link href="/gorun" className="font-semibold text-sky-700 hover:text-sky-800">
                  Find or create a run
                </Link>
              </p>
            </div>

            <GoRunUpcomingRunsPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
