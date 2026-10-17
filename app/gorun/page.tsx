"use client";

import Link from "next/link";
import { Compass, Dumbbell, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
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
                Build a workout, create a run invite, or find a club run in your area.
              </p>
            </div>

            <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Link
                href="/workouts/create"
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition group h-full"
              >
                <div className="rounded-xl bg-orange-100 p-2.5 w-fit mb-3">
                  <Dumbbell className="h-6 w-6 text-orange-700" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Build a Workout</h2>
                <p className="text-sm text-gray-600 mt-1">Prescribe segments or attach when you host.</p>
              </Link>
              <Link
                href="/host-a-run"
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300 transition group h-full"
              >
                <div className="rounded-xl bg-orange-100 p-2.5 w-fit mb-3">
                  <Users className="h-6 w-6 text-orange-700" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Create a Run</h2>
                <p className="text-sm text-gray-600 mt-1">Meetup, time, optional workout.</p>
              </Link>
              <Link
                href="/discoverruns"
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-sky-300 transition group h-full"
              >
                <div className="rounded-xl bg-sky-100 p-2.5 w-fit mb-3 group-hover:bg-sky-200/80">
                  <Compass className="h-6 w-6 text-sky-800" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Find a Run</h2>
                <p className="text-sm text-gray-600 mt-1">Club runs in your region.</p>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
