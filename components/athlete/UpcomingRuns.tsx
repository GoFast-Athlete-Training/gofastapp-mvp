"use client";

import Link from "next/link";

export type UpcomingWorkoutRow = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  matchedActivityId: string | null;
  derivedPerformanceDirection?: string | null;
  segments?: { stepOrder: number; targets: unknown }[];
};

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function mainTargetSecPerMile(segments: UpcomingWorkoutRow["segments"]): number | null {
  if (!segments?.length) return null;
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const arr = seg.targets as { type?: string; valueLow?: number; value?: number }[] | null;
    if (!Array.isArray(arr) || !arr[0]) continue;
    const t = arr[0];
    if (String(t.type || "").toUpperCase() !== "PACE") continue;
    const low = t.valueLow ?? t.value;
    if (low == null || typeof low !== "number") continue;
    return Math.round(low * 1.60934);
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

export default function UpcomingRuns({ workouts }: { workouts: UpcomingWorkoutRow[] }) {
  if (!workouts.length) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming runs</h2>
        <p className="text-sm text-gray-600 mt-2">No scheduled workouts yet.</p>
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
        {workouts.map((w) => {
          const target = mainTargetSecPerMile(w.segments);
          const st = statusFor(w);
          const day =
            w.date != null
              ? new Date(w.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "Date TBD";
          return (
            <li key={w.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{w.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {day} · <span className="capitalize">{String(w.workoutType).toLowerCase()}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {target != null && (
                  <span className="text-sm text-gray-700">
                    Target <span className="font-semibold">{formatSecPerMile(target)}</span>
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.className}`}>{st.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
