"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  phases: unknown;
  planWeeks: unknown;
  preferredDays: number[];
  race_registry: {
    name: string;
    raceDate: string;
  } | null;
};

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

/** Default when plan has no preferredDays yet (matches generate API fallback). */
const DEFAULT_PREFERRED_DAYS = [1, 2, 3, 4, 5, 6];

function parsePlanWeekEntries(
  planWeeks: unknown
): { weekNumber: number; phase: string; schedule: string }[] {
  if (!Array.isArray(planWeeks)) return [];
  const out: { weekNumber: number; phase: string; schedule: string }[] = [];
  for (const w of planWeeks) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    const weekNumber = Number(o.weekNumber);
    if (!Number.isFinite(weekNumber)) continue;
    const phase = typeof o.phase === "string" ? o.phase : String(o.phase ?? "");
    const schedule = typeof o.schedule === "string" ? o.schedule : "";
    out.push({ weekNumber, phase, schedule });
  }
  out.sort((a, b) => a.weekNumber - b.weekNumber);
  return out;
}

export default function TrainingSetupPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState<
    Array<{
      id: string;
      title: string;
      workoutType: string;
      date: string | null;
      estimatedDistanceInMeters: number | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekNumber, setWeekNumber] = useState(1);
  const [preferredDaysLocal, setPreferredDaysLocal] = useState<number[]>(
    DEFAULT_PREFERRED_DAYS
  );
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/training-plan/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load plan");
        setPlan(null);
        return;
      }
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!plan) return;
    const pd = plan.preferredDays;
    if (Array.isArray(pd) && pd.length > 0) {
      setPreferredDaysLocal(
        [...pd].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b)
      );
    } else {
      setPreferredDaysLocal([...DEFAULT_PREFERRED_DAYS]);
    }
  }, [plan?.id, plan?.preferredDays]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthReady(false);
        router.replace("/welcome");
        return;
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    loadPlan();
  }, [authReady, loadPlan]);

  const hasSchedule = useMemo(() => {
    if (!plan?.planWeeks) return false;
    return Array.isArray(plan.planWeeks) && plan.planWeeks.length > 0;
  }, [plan?.planWeeks]);

  const weekEntries = useMemo(
    () => (plan ? parsePlanWeekEntries(plan.planWeeks) : []),
    [plan]
  );

  const fetchWeekWorkouts = useCallback(
    async (wn: number) => {
      setLoadingWeek(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/training/week?planId=${encodeURIComponent(planId)}&weekNumber=${wn}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load week");
          setWeekWorkouts([]);
          return;
        }
        setWeekWorkouts(data.workouts || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Week load failed");
        setWeekWorkouts([]);
      } finally {
        setLoadingWeek(false);
      }
    },
    [planId]
  );

  useEffect(() => {
    if (!authReady || !plan || !hasSchedule) return;
    void fetchWeekWorkouts(weekNumber);
  }, [authReady, plan, hasSchedule, weekNumber, fetchWeekWorkouts]);

  function togglePreferredDay(d: number) {
    setPreferredDaysLocal((prev) => {
      if (prev.includes(d)) {
        const next = prev.filter((x) => x !== d);
        return next.length > 0 ? next : prev;
      }
      return [...prev, d].sort((a, b) => a - b);
    });
  }

  async function savePreferredAndGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const normalized = preferredDaysLocal.filter((d) => d >= 1 && d <= 7);
      if (normalized.length === 0) {
        setError("Select at least one preferred training day.");
        return;
      }
      const patchRes = await fetch(`/api/training-plan/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferredDays: normalized }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        setError(patchData.error || "Could not save preferences");
        return;
      }

      const genRes = await fetch("/api/training-plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trainingPlanId: planId }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error || "Generation failed");
        return;
      }
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !plan) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-gray-700">
          {error ? <p className="text-red-600">{error}</p> : <p>Loading…</p>}
          <Link
            href="/training-setup"
            className="text-sm text-orange-600 hover:text-orange-700"
          >
            Back
          </Link>
        </div>
      </AthleteAppShell>
    );
  }

  return (
    <AthleteAppShell>
      <div className="px-4 py-8 sm:px-6 bg-gray-50 min-h-screen">
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">{plan.name}</h1>
          {plan.race_registry && (
            <p className="text-gray-600 text-sm mb-4">
              Race: {plan.race_registry.name} —{" "}
              {new Date(plan.race_registry.raceDate).toLocaleDateString()}
            </p>
          )}
          <p className="text-gray-600 text-sm mb-4">
            {plan.totalWeeks} weeks · Start{" "}
            {new Date(plan.startDate).toLocaleDateString()}
          </p>

          {!hasSchedule && (
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Preferred training days
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  The AI uses these when building your weekly schedule (Mon–Sun).
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        checked={preferredDaysLocal.includes(value)}
                        onChange={() => togglePreferredDay(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={savePreferredAndGenerate}
                disabled={generating}
                className="w-full rounded-lg bg-orange-500 text-white py-3 font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate my plan"}
              </button>
            </div>
          )}

          {hasSchedule && (
            <>
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Your schedule is ready ({weekEntries.length} weeks). Same compact
                format as club run schedules.
              </div>

              <div className="mb-6 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  All weeks
                </p>
                <ul className="space-y-1.5 font-mono text-xs text-gray-800">
                  {weekEntries.map((w) => (
                    <li key={w.weekNumber}>
                      <span className="text-gray-500">W{w.weekNumber}</span>
                      {w.phase ? (
                        <span className="text-gray-600"> ({w.phase})</span>
                      ) : null}
                      {" — "}
                      {w.schedule || "—"}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 mb-6">
                <label className="block text-sm font-medium text-gray-800">
                  Workouts for week
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={plan.totalWeeks}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                    value={weekNumber}
                    onChange={(e) =>
                      setWeekNumber(
                        Math.min(
                          plan.totalWeeks,
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      )
                    }
                  />
                  {loadingWeek && (
                    <span className="text-xs text-gray-500">Loading…</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Week 1 loads automatically. Change the number to materialize
                  another week (creates workouts from the schedule string).
                </p>
              </div>
            </>
          )}

          {weekWorkouts.length > 0 && (
            <ul className="space-y-2 mb-6">
              {weekWorkouts.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/workouts/${w.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-3 hover:border-orange-300 hover:bg-orange-50/30"
                  >
                    <div className="font-medium text-gray-900">{w.title}</div>
                    <div className="text-xs text-gray-500">
                      {w.date
                        ? new Date(w.date).toLocaleDateString()
                        : "No date"}{" "}
                      · {w.workoutType}
                      {w.estimatedDistanceInMeters != null
                        ? ` · ${(w.estimatedDistanceInMeters / 1609.34).toFixed(1)} mi planned`
                        : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {hasSchedule && !loadingWeek && weekWorkouts.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">
              No workouts for this week yet. If an error appeared above, check
              your profile 5K pace (needed to build segments).
            </p>
          )}

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/training-setup" className="hover:text-orange-600">
              New plan
            </Link>
            <Link href="/training" className="hover:text-orange-600">
              Training hub
            </Link>
            <Link href="/workouts" className="hover:text-orange-600">
              All workouts
            </Link>
          </div>
        </div>
      </div>
    </AthleteAppShell>
  );
}
