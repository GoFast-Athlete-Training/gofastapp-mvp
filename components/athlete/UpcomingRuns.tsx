"use client";

import Link from "next/link";
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
} from "@/lib/workout-generator/pace-calculator";

export type UpcomingWorkoutRow = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  matchedActivityId: string | null;
  derivedPerformanceDirection?: string | null;
  segments?: { stepOrder: number; targets: unknown }[];
  /** Present when a DB row exists (open day in My Training). */
  workoutId?: string | null;
  /** From planWeeks before lazy materialization. */
  isPlanSession?: boolean;
};

/** First segment PACE target, same encoding as workout detail / {@link formatStoredPaceAsMinPerMile}. */
function mainPaceTargetLabel(segments: UpcomingWorkoutRow["segments"]): string | null {
  if (!segments?.length) return null;
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const arr = seg.targets as
      | { type?: string; valueLow?: number; valueHigh?: number; value?: number }[]
      | null;
    if (!Array.isArray(arr) || !arr[0]) continue;
    const t = arr[0];
    if (String(t.type || "").toUpperCase() !== "PACE") continue;
    const low = t.valueLow ?? t.value;
    const high = t.valueHigh;
    if (low != null && typeof low === "number" && high != null && typeof high === "number") {
      return formatPaceTargetRangeForDisplay(low, high);
    }
    if (low != null && typeof low === "number") {
      return formatPaceTargetSingleForDisplay(low);
    }
  }
  return null;
}

function statusFor(w: UpcomingWorkoutRow): { label: string; className: string } {
  if (w.matchedActivityId) {
    const d = w.derivedPerformanceDirection;
    if (d === "positive") return { label: "Completed · on target", className: "bg-emerald-50 text-emerald-800" };
    if (d === "negative") return { label: "Completed · review", className: "bg-amber-50 text-amber-900" };
    if (d === "neutral") return { label: "Completed", className: "bg-gray-100 text-gray-800" };
    return { label: "Completed", className: "bg-gray-100 text-gray-800" };
  }
  const d = w.date ? new Date(w.date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d && d < today) return { label: "Missed", className: "bg-red-50 text-red-800" };
  return { label: "Upcoming", className: "bg-sky-50 text-sky-900" };
}

function WorkoutRowItem({ w }: { w: UpcomingWorkoutRow }) {
  const paceLabel = mainPaceTargetLabel(w.segments);
  const st = statusFor(w);
  const day =
    w.date != null
      ? new Date(w.date).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "Date TBD";
  const detailHref =
    w.workoutId && String(w.workoutId).length > 0
      ? `/workouts/${w.workoutId}`
      : "/training";
  return (
    <li className="py-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href={detailHref} className="group block">
          <p className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">{w.title}</p>
        </Link>
        <p className="text-sm text-gray-500 mt-0.5">
          {day} · <span className="capitalize">{String(w.workoutType).toLowerCase()}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {paceLabel != null && (
          <span className="text-sm text-gray-700">
            Target <span className="font-semibold">{paceLabel}</span>
          </span>
        )}
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.className}`}>{st.label}</span>
      </div>
    </li>
  );
}

export default function UpcomingRuns({ upcoming }: { upcoming: UpcomingWorkoutRow[] }) {
  if (!upcoming.length) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming runs</h2>
        <p className="text-sm text-gray-600 mt-2">Nothing on your calendar from today forward.</p>
        <p className="text-sm text-gray-500 mt-1">
          Past or missed workouts stay on{" "}
          <Link href="/workouts" className="text-orange-600 font-medium hover:underline">
            My Training
          </Link>
          .
        </p>
        <Link href="/workouts/create" className="inline-block mt-4 text-orange-600 font-medium hover:underline">
          Add a workout →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming runs</h2>
        <Link href="/workouts" className="text-sm text-orange-600 font-medium hover:underline">
          All training →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {upcoming.map((w) => (
          <WorkoutRowItem key={w.id} w={w} />
        ))}
      </ul>
    </div>
  );
}
