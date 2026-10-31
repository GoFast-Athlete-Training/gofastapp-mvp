"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Users } from "lucide-react";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import ScheduleRunForm from "@/components/training/ScheduleRunForm";
import { parseBackHrefParam, backLabelFromPath } from "@/lib/training/workout-nav-query";

function PlanThisRunInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = (params.id as string) || "";
  const backHref = parseBackHrefParam(searchParams) ?? `/workouts/${workoutId}?back=/gorun`;
  const backLabel = backLabelFromPath(backHref);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </Link>

            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="w-6 h-6 text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900">Plan this run</h1>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Set date, start time, meetup spot, and optional route. Invite people when you are ready.
            </p>

            <ScheduleRunForm
              initialWorkoutId={workoutId}
              onCancel={() => router.push(backHref)}
              onDone={() => router.push(backHref)}
            />

            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Optional</p>
              <Link
                href={`/gorun/routes/new`}
                className="block text-sm font-semibold text-emerald-800 hover:underline"
              >
                Build a route (standalone)
              </Link>
              <Link
                href={`/workouts/${workoutId}/let-others-join`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
              >
                <Users className="w-4 h-4" />
                Invite people (meetup + RSVP)
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PlanThisRunPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <PlanThisRunInner />
    </Suspense>
  );
}
