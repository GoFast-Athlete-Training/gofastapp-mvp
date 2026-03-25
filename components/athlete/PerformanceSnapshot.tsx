"use client";

import Link from "next/link";

function parsePaceToSecPerMile(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const m = pace.trim().match(/^(\d+):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

export default function PerformanceSnapshot({
  fiveKPace,
  goalRacePaceSecPerMile,
}: {
  fiveKPace: string | null | undefined;
  goalRacePaceSecPerMile: number | null | undefined;
}) {
  const current = parsePaceToSecPerMile(fiveKPace ?? null);
  const goal = goalRacePaceSecPerMile ?? null;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance snapshot</h2>

      {!goal ? (
        <p className="text-sm text-gray-600 mb-4">
          Set a race goal to see how your current fitness compares to race pace.
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current 5K pace</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {current != null ? formatSecPerMile(current) : "—"}
          </p>
          {!fiveKPace && (
            <p className="text-xs text-gray-500 mt-2">
              <a href="/athlete-edit-profile" className="text-orange-600 font-medium hover:underline">
                Edit profile
              </a>{" "}
              to set current 5K pace (training baseline).
            </p>
          )}
        </div>
        <div className="rounded-lg bg-orange-50 p-4 border border-orange-100">
          <p className="text-xs font-medium text-orange-800 uppercase tracking-wide">Race goal pace</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{goal != null ? formatSecPerMile(goal) : "—"}</p>
        </div>
        <div className="rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vs goal</p>
          {current != null && goal != null ? (
            (() => {
              const delta = current - goal;
              const absSec = Math.abs(delta);
              const ahead = delta < 0;
              const label = ahead
                ? `${absSec}s faster than goal pace`
                : delta === 0
                  ? "On goal pace"
                  : `${absSec}s slower than goal pace`;
              return (
                <>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      ahead ? "text-emerald-600" : delta > 0 ? "text-amber-700" : "text-gray-900"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Negative gap = you&apos;re ahead of your goal. Positive = room to build fitness.
                  </p>
                </>
              );
            })()
          ) : (
            <p className="text-sm text-gray-500 mt-1">Add a goal and current pace to see delta.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/goals" className="text-sm text-orange-600 font-medium hover:underline">
          Edit goal →
        </Link>
      </div>
    </div>
  );
}
