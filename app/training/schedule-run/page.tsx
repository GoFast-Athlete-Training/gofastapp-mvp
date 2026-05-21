"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import ScheduleRunForm from "@/components/training/ScheduleRunForm";

function ScheduleRunPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || undefined;
  const workoutId = searchParams.get("workoutId") || undefined;

  return (
    <AthleteAppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <button
          type="button"
          onClick={() => router.push(date ? "/training" : "/training")}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Training
        </button>

        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Schedule this run</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Lock in a time, optional meetup spot, and share with a friend. No full CityRun setup required.
        </p>

        <ScheduleRunForm
          initialDate={date}
          initialWorkoutId={workoutId}
          onCancel={() => router.push("/training")}
          onDone={() => router.push("/training")}
        />

        <p className="mt-6 text-xs text-gray-500">
          Want a public city listing with RSVP?{" "}
          {workoutId ? (
            <Link
              href={`/workouts/${workoutId}/let-others-join`}
              className="text-sky-700 font-medium hover:underline"
            >
              Build a full CityRun
            </Link>
          ) : (
            <Link href="/build-a-run" className="text-sky-700 font-medium hover:underline">
              Build a run
            </Link>
          )}
        </p>
      </div>
    </AthleteAppShell>
  );
}

export default function ScheduleRunPage() {
  return (
    <Suspense
      fallback={
        <AthleteAppShell>
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
          </div>
        </AthleteAppShell>
      }
    >
      <ScheduleRunPageInner />
    </Suspense>
  );
}
