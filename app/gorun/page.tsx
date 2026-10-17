"use client";

import Link from "next/link";
import { Compass, Dumbbell, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import WebRunsDiscover from "@/components/runs/WebRunsDiscover";
import HostedRunInvitesPanel from "@/components/runs/HostedRunInvitesPanel";

export default function GoRunPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
            <div className="border-b border-gray-200 pb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Run</p>
              <h1 className="text-3xl font-bold text-gray-900 mt-1 mb-2">Run</h1>
              <p className="text-gray-600">
                Discover club runs, open the public page to show someone, or build and host your own.
              </p>
            </div>

            <WebRunsDiscover />

            <section className="space-y-4 border-t border-gray-200 pt-8">
              <h2 className="text-lg font-semibold text-gray-900">Build &amp; host</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/workouts/create"
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition group"
                >
                  <div className="rounded-xl bg-orange-100 p-2.5 w-fit mb-3">
                    <Dumbbell className="h-6 w-6 text-orange-700" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Build a workout</h3>
                  <p className="text-sm text-gray-600 mt-1">Prescribe segments or attach when you host.</p>
                </Link>
                <Link
                  href="/host-a-run"
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition group"
                >
                  <div className="rounded-xl bg-orange-100 p-2.5 w-fit mb-3">
                    <Users className="h-6 w-6 text-orange-700" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Create a run</h3>
                  <p className="text-sm text-gray-600 mt-1">Meetup, time, optional workout.</p>
                </Link>
                <Link
                  href="/build-a-run/discover"
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition group sm:col-span-2"
                >
                  <div className="rounded-xl bg-sky-100 p-2.5 w-fit mb-3 group-hover:bg-sky-200/80">
                    <Compass className="h-6 w-6 text-sky-800" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Find a route</h3>
                  <p className="text-sm text-gray-600 mt-1">Search saved routes to attach to a run invite.</p>
                </Link>
              </div>
              <HostedRunInvitesPanel />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
