"use client";

import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import BuildRouteForm from "@/components/runs/BuildRouteForm";

export default function GoRunBuildRoutePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div>
              <Link href="/gorun" className="text-sm font-semibold text-orange-700 hover:underline">
                ← Back to Run
              </Link>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mt-4">Run</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">Build a route</h1>
              <p className="text-sm text-gray-600 mt-1">
                Save a Strava route for meetups or your own reference. No run invite required.
              </p>
            </div>
            <BuildRouteForm />
          </div>
        </main>
      </div>
    </div>
  );
}
