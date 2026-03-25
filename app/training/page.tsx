"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, Dumbbell, Trash2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";

type ActivePlanRow = {
  id: string;
  name: string;
  planWeeks: unknown;
  race_registry: { name: string } | null;
};

function scheduleReady(p: ActivePlanRow): boolean {
  return (
    p.planWeeks != null &&
    Array.isArray(p.planWeeks) &&
    (p.planWeeks as unknown[]).length > 0
  );
}

export default function TrainingHubPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [activePlan, setActivePlan] = useState<ActivePlanRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadActivePlan = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch("/api/training-plan?status=active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.plans)) {
        setActivePlan(null);
        return;
      }
      setActivePlan((data.plans[0] as ActivePlanRow) ?? null);
    } catch {
      setActivePlan(null);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

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
    void loadActivePlan();
  }, [authReady, loadActivePlan]);

  async function deleteActivePlan() {
    if (!activePlan) return;
    if (
      !window.confirm(
        "Delete this training plan permanently? Workouts will stay on your log but won’t be tied to this plan."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch(`/api/training-plan/${activePlan.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActivePlan(null);
        await loadActivePlan();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AthleteAppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training</h1>
          <p className="text-gray-600">
            Build a full race plan or log a one-off workout—your choice.
          </p>
        </div>

        {authReady && !loadingPlans && activePlan && (
          <div className="mb-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Current plan
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">{activePlan.name}</h2>
                {activePlan.race_registry?.name && (
                  <p className="mt-1 text-sm text-gray-600">{activePlan.race_registry.name}</p>
                )}
                <p className="mt-2 text-sm text-emerald-900/80">
                  {scheduleReady(activePlan) ? "Schedule is ready." : "Finish generating your schedule in the plan."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <Link
                  href={`/training-setup/${activePlan.id}`}
                  className="inline-flex justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Open your plan
                </Link>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void deleteActivePlan()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {deleting ? "Deleting…" : "Delete plan"}
                </button>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-600">
              Starting setup again can create a new plan; we’ll warn you if it would replace this one.
            </p>
          </div>
        )}

        {authReady && loadingPlans && (
          <p className="mb-6 text-sm text-gray-500">Loading your plan…</p>
        )}

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          <Link
            href="/training-setup"
            className="group block rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm transition hover:border-orange-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <CalendarRange className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-orange-700">
              {activePlan ? "Set up a new training plan" : "Set up a training plan"}
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Pick your active goal (race + goal time), start date, and baseline. If you already have
              a plan, we’ll help you open it or replace it on purpose—not by accident.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-orange-600">
              {activePlan ? "Plan setup →" : "Start plan setup →"}
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
