"use client";

import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import GoRunPastSections from "@/components/runs/GoRunPastSections";

export default function GoRunPastGroupRunsPage() {
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
            <h1 className="text-2xl font-bold text-gray-900">My Past Group Runs</h1>
            <GoRunPastSections expanded mode="group" />
          </div>
        </main>
      </div>
    </div>
  );
}
