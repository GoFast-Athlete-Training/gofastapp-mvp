"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutList } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import PhaseViewModal from "@/components/training/PhaseViewModal";
import {
  parsePhasesJson,
  phaseNameForWeek,
  type PhaseRange,
} from "@/lib/training/plan-phases";

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
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
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

  const phaseRanges: PhaseRange[] = useMemo(
    () => (plan ? parsePhasesJson(plan.phases) : []),
    [plan?.phases]
  );

  const weekEntries = useMemo(
    () => (plan ? parsePlanWeekEntries(plan.planWeeks) : []),
    [plan]
  );

  const currentWeekEntry = useMemo(
    () => weekEntries.find((w) => w.weekNumber === weekNumber),
    [weekEntries, weekNumber]
  );

  const weekPhaseLabel = useMemo(() => {
    if (!currentWeekEntry) return "";
    return phaseNameForWeek(
      phaseRanges,
      weekNumber,
      currentWeekEntry.phase
    );
  }, [phaseRanges, weekNumber, currentWeekEntry]);

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

  function goPrevWeek() {
    setWeekNumber((n) => Math.max(1, n - 1));
  }

  function goNextWeek() {
    if (!plan) return;
    setWeekNumber((n) => Math.min(plan.totalWeeks, n + 1));
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
                  We use these when building each week (Mon–Sun).
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
              <p className="mb-4 text-sm text-gray-700">
                Your schedule is ready. Use the preview below to step through weeks
                and open each workout.
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPhaseModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <LayoutList className="h-4 w-4" aria-hidden />
                  View phases &amp; all weeks
                </button>
              </div>

              <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Week preview
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      Week {weekNumber} of {plan.totalWeeks}
                    </p>
                    {weekPhaseLabel && (
                      <span className="mt-1 inline-block text-xs font-medium text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full">
                        {weekPhaseLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={goPrevWeek}
                      disabled={weekNumber <= 1}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNextWeek}
                      disabled={weekNumber >= plan.totalWeeks}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {currentWeekEntry?.schedule ? (
                  <p className="text-sm text-gray-800 leading-relaxed break-words">
                    {currentWeekEntry.schedule}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">No schedule line for this week.</p>
                )}
                {loadingWeek && (
                  <p className="mt-2 text-xs text-gray-500">Loading workouts…</p>
                )}
              </div>
            </>
          )}

          {weekWorkouts.length > 0 && (
            <ul className="space-y-3 mb-6">
              {weekWorkouts.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/workouts/${w.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-300 hover:shadow-md transition"
                  >
                    <div className="text-base font-semibold text-gray-900 leading-snug">
                      {w.title}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {w.date
                        ? new Date(w.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Date TBD"}
                      <span className="text-gray-400"> · </span>
                      {w.workoutType}
                      {w.estimatedDistanceInMeters != null
                        ? ` · ${(w.estimatedDistanceInMeters / 1609.34).toFixed(1)} mi`
                        : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {hasSchedule && !loadingWeek && weekWorkouts.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">
              No workouts for this week yet. If something failed above, set your
              5K pace on your profile so we can build segments.
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

      <PhaseViewModal
        open={phaseModalOpen}
        onClose={() => setPhaseModalOpen(false)}
        phases={phaseRanges}
        planWeeks={weekEntries}
        onJumpToWeek={(wn) => setWeekNumber(wn)}
      />
    </AthleteAppShell>
  );
}
