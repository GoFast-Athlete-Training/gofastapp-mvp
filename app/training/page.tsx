"use client";

import Link from "next/link";
import { CalendarRange, Dumbbell } from "lucide-react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";

export default function TrainingHubPage() {
  return (
    <AthleteAppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training</h1>
          <p className="text-gray-600">
            Build a full race plan or log a one-off workout—your choice.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          <Link
            href="/training-setup"
            className="group block rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm transition hover:border-orange-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <CalendarRange className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-orange-700">
              Set up a training plan
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Pick a race, baseline, and start date. We&apos;ll generate a structured schedule you can
              follow week by week.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-orange-600">
              Start plan setup →
            </span>
          </Link>

          <Link
            href="/workouts"
            className="group block rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm transition hover:border-orange-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Dumbbell className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-orange-700">
              Single workout
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Plan a standalone session or review your activity—without committing to a full plan.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-orange-600">
              Go to workouts →
            </span>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Need a quick entry?{" "}
          <Link href="/workouts/create" className="font-medium text-orange-600 hover:text-orange-700">
            Create a workout
          </Link>
        </p>
      </div>
    </AthleteAppShell>
  );
}
