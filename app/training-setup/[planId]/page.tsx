"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  phases: unknown;
  planWeeks: unknown;
  race_registry: {
    name: string;
    raceDate: string;
  } | null;
};

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
  const [error, setError] = useState<string | null>(null);

  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  async function loadPlan() {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/welcome");
      return;
    }
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
  }

  useEffect(() => {
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, router]);

  async function runAiGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/training-plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trainingPlanId: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function loadWeek() {
    if (!plan) return;
    setLoadingWeek(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/training/week?planId=${encodeURIComponent(planId)}&weekNumber=${weekNumber}`,
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
    } finally {
      setLoadingWeek(false);
    }
  }

  if (loading || !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        {error ? <p className="text-red-400">{error}</p> : <p>Loading…</p>}
        <Link href="/training-setup" className="text-slate-400 text-sm">
          Back
        </Link>
      </div>
    );
  }

  const hasSchedule =
    plan.planWeeks != null &&
    Array.isArray(plan.planWeeks) &&
    plan.planWeeks.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-1">{plan.name}</h1>
      {plan.race_registry && (
        <p className="text-slate-400 text-sm mb-4">
          Race: {plan.race_registry.name} —{" "}
          {new Date(plan.race_registry.raceDate).toLocaleDateString()}
        </p>
      )}
      <p className="text-slate-400 text-sm mb-4">
        {plan.totalWeeks} weeks · Start{" "}
        {new Date(plan.startDate).toLocaleDateString()}
      </p>

      {!hasSchedule && (
        <button
          type="button"
          onClick={runAiGenerate}
          disabled={generating}
          className="w-full rounded bg-amber-500 text-slate-950 py-3 font-medium mb-6 disabled:opacity-50"
        >
          {generating ? "Generating schedule…" : "Generate AI schedule"}
        </button>
      )}

      {hasSchedule && (
        <div className="mb-6 rounded border border-slate-700 bg-slate-900/50 p-3 text-sm text-emerald-400">
          Schedule ready ({(plan.planWeeks as unknown[]).length} weeks).
        </div>
      )}

      {hasSchedule && (
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium">Preview week #</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={plan.totalWeeks}
              className="w-24 rounded bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value) || 1)}
            />
            <button
              type="button"
              onClick={loadWeek}
              disabled={loadingWeek}
              className="rounded bg-slate-700 px-4 py-2 text-sm disabled:opacity-50"
            >
              {loadingWeek ? "Loading…" : "Load week workouts"}
            </button>
          </div>
        </div>
      )}

      {weekWorkouts.length > 0 && (
        <ul className="space-y-2 mb-6">
          {weekWorkouts.map((w) => (
            <li key={w.id}>
              <Link
                href={`/workouts/${w.id}`}
                className="block rounded border border-slate-700 bg-slate-900/80 p-3 hover:border-slate-500"
              >
                <div className="font-medium">{w.title}</div>
                <div className="text-xs text-slate-400">
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

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="flex gap-4 text-sm text-slate-500">
        <Link href="/training-setup">New plan</Link>
        <Link href="/athlete-home">Home</Link>
        <Link href="/workouts">All workouts</Link>
      </div>
    </div>
  );
}
