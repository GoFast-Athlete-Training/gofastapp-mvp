"use client";

import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import WebRunsDiscover from "@/components/runs/WebRunsDiscover";

export default function DiscoverRunsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav showBack backUrl="/gorun" backLabel="Run" />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Run</p>
              <h1 className="text-3xl font-bold text-gray-900 mt-1 mb-2">Find a run</h1>
              <p className="text-gray-600">Club runs in your region.</p>
            </div>
            <WebRunsDiscover />
            <p className="text-sm text-gray-500 pt-2">
              <Link href="/gorun" className="font-medium text-gray-700 hover:text-gray-900">
                ← Back to Run hub
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
