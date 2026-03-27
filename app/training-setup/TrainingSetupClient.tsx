"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";

type RaceRegistryLite = {
  id: string;
  name: string;
  raceDate: string;
  raceType: string;
  distanceMiles: number;
  city?: string | null;
  state?: string | null;
};

type GoalRow = {
  id: string;
  status: string;
  goalTime: string | null;
  raceRegistryId: string | null;
  targetByDate: string;
  name?: string | null;
  race_registry: RaceRegistryLite | null;
};

type SignupRow = {
  id: string;
  raceRegistryId: string;
  race_registry: RaceRegistryLite | null;
};

function goalTimeReady(g: GoalRow): boolean {
  return typeof g.goalTime === "string" && g.goalTime.trim().length > 0;
}

function goalRaceReady(g: GoalRow): boolean {
  return !!g.raceRegistryId && !!g.race_registry;
}

function isQualifyingGoal(g: GoalRow): boolean {
  return g.status === "ACTIVE" && goalRaceReady(g) && goalTimeReady(g);
}

type ActivePlanLite = {
  id: string;
  name: string;
  athleteGoalId: string | null;
  lifecycleStatus: string;
  planWeeks: unknown;
  _count?: { planned_workouts: number };
  race_registry: { name: string } | null;
};

function formatRaceWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

/** Map API failures to safe UX (avoid surfacing raw 400 strings). */
function planCreateFeedbackKind(
  status: number,
  message?: string
): "goals" | "dates" | "generic" {
  const m = (message ?? "").toLowerCase();
  if (status === 400) {
    if (m.includes("before race") || m.includes("invalid startdate")) {
      return "dates";
    }
    return "goals";
  }
  if (status === 404) {
    return "goals";
  }
  return "generic";
}

export default function TrainingSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalIdFromUrl = searchParams.get("goalId")?.trim() ?? "";

  const [ready, setReady] = useState(false);
  const [loadingOrientation, setLoadingOrientation] = useState(true);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [orientationError, setOrientationError] = useState<string | null>(null);

  const [wizardGoal, setWizardGoal] = useState<GoalRow | null>(null);
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<
    "goals" | "dates" | "generic" | null
  >(null);
  const [baseline5KPace, setBaseline5KPace] = useState("");
  const [baselineWeeklyMileage, setBaselineWeeklyMileage] = useState("");
  const [activePlans, setActivePlans] = useState<ActivePlanLite[]>([]);
  const [replaceGoalAcknowledged, setReplaceGoalAcknowledged] = useState(false);
  const [replaceBlockPlan, setReplaceBlockPlan] = useState<ActivePlanLite | null>(null);

  const qualifyingGoals = useMemo(() => goals.filter(isQualifyingGoal), [goals]);

  const incompleteRaceNeedsTime = useMemo(
    () =>
      goals.some(
        (g) => g.status === "ACTIVE" && goalRaceReady(g) && !goalTimeReady(g)
      ),
    [goals]
  );

  const activeNeedsRace = useMemo(
    () => goals.some((g) => g.status === "ACTIVE" && !goalRaceReady(g)),
    [goals]
  );

  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  const loadOrientation = useCallback(async () => {
    setLoadingOrientation(true);
    setOrientationError(null);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [gRes, sRes, pRes] = await Promise.all([
        fetch("/api/goals?status=ACTIVE", { headers }),
        fetch("/api/race-signups", { headers }),
        fetch("/api/training-plan?status=active", { headers }),
      ]);
      const gJson = await gRes.json();
      const sJson = await sRes.json();
      const pJson = await pRes.json();
      if (pRes.ok && Array.isArray(pJson.plans)) {
        setActivePlans(pJson.plans as ActivePlanLite[]);
      } else {
        setActivePlans([]);
      }
      if (!gRes.ok) {
        setOrientationError(gJson.error || "Failed to load goals");
        setGoals([]);
      } else {
        setGoals(gJson.goals ?? []);
      }
      if (!sRes.ok) {
        setSignups([]);
      } else {
        setSignups(sJson.signups ?? []);
      }
    } catch (e) {
      setOrientationError(e instanceof Error ? e.message : "Load failed");
      setGoals([]);
      setSignups([]);
      setActivePlans([]);
    } finally {
      setLoadingOrientation(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setReady(true);
      } else {
        setReady(false);
        router.replace("/welcome");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    loadOrientation();
  }, [ready, loadOrientation]);

  useEffect(() => {
    if (!ready || loadingOrientation || qualifyingGoals.length === 0) return;
    if (!goalIdFromUrl) return;
    const g = qualifyingGoals.find((x) => x.id === goalIdFromUrl);
    if (g) {
      setWizardGoal(g);
    }
  }, [ready, loadingOrientation, qualifyingGoals, goalIdFromUrl]);

  useEffect(() => {
    if (!ready || !wizardGoal) return;
    const id = LocalStorageAPI.getAthleteId();
    if (!id) return;
    api
      .get<{ athlete?: { fiveKPace?: string | null; weeklyMileage?: number | null } }>(
        `/athlete/${id}`
      )
      .then((res) => {
        const a = res.data?.athlete;
        if (!a) return;
        setBaseline5KPace(a.fiveKPace?.trim() ?? "");
        setBaselineWeeklyMileage(
          a.weeklyMileage != null && Number.isFinite(Number(a.weeklyMileage))
            ? String(a.weeklyMileage)
            : ""
        );
      })
      .catch(() => {});
  }, [ready, wizardGoal]);

  useEffect(() => {
    setCreateFeedback((prev) => (prev === "dates" ? null : prev));
  }, [startDate]);

  function beginWizardForGoal(g: GoalRow) {
    setWizardGoal(g);
    setFormError(null);
    setCreateFeedback(null);
    setReplaceGoalAcknowledged(false);
    setReplaceBlockPlan(null);
    const today = new Date();
    setStartDate(today.toISOString().split("T")[0]);
    router.replace(`/training-setup?goalId=${encodeURIComponent(g.id)}`, { scroll: false });
  }

  function exitWizard() {
    setWizardGoal(null);
    setFormError(null);
    setCreateFeedback(null);
    setReplaceGoalAcknowledged(false);
    setReplaceBlockPlan(null);
    router.replace("/training-setup", { scroll: false });
  }

  async function refreshGoalsAndExitWizard() {
    setCreateFeedback(null);
    await loadOrientation();
    exitWizard();
  }

  async function createPlan(opts?: { forceReplace?: boolean }) {
    if (!wizardGoal?.race_registry || !wizardGoal.raceRegistryId) {
      setFormError(null);
      setCreateFeedback("goals");
      return;
    }
    if (!startDate) {
      setFormError("Pick a start date for your plan.");
      return;
    }

    const conflicting = activePlans.find(
      (p) => p.lifecycleStatus === "ACTIVE" && p.athleteGoalId === wizardGoal.id
    );
    const mayReplace = replaceGoalAcknowledged || opts?.forceReplace === true;
    if (conflicting && !mayReplace) {
      setReplaceBlockPlan(conflicting);
      setFormError(null);
      setCreateFeedback(null);
      return;
    }
    setReplaceBlockPlan(null);
    if (opts?.forceReplace) setReplaceGoalAcknowledged(true);

    setCreating(true);
    setFormError(null);
    setCreateFeedback(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          athleteGoalId: wizardGoal.id,
          raceRegistryId: wizardGoal.raceRegistryId,
          startDate: new Date(startDate).toISOString(),
          fiveKPace: baseline5KPace.trim() || null,
          currentWeeklyMileage:
            baselineWeeklyMileage.trim() === ""
              ? null
              : Number(baselineWeeklyMileage),
          syncAthleteBaseline: true,
        }),
      });
      let data: { error?: string; plan?: { id: string } } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setCreateFeedback(planCreateFeedbackKind(res.status, data.error));
        return;
      }
      if (data.plan?.id) {
        setReplaceGoalAcknowledged(false);
        router.push(`/training-setup/${data.plan.id}`);
      } else {
        setCreateFeedback("generic");
      }
    } catch {
      setCreateFeedback("generic");
    } finally {
      setCreating(false);
    }
  }

  function scheduleReady(p: ActivePlanLite): boolean {
    const materialized = p._count?.planned_workouts ?? 0;
    const legacy =
      p.planWeeks != null &&
      Array.isArray(p.planWeeks) &&
      (p.planWeeks as unknown[]).length > 0;
    return materialized > 0 || legacy;
  }

  if (!ready) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[50vh] items-center justify-center text-gray-600">Loading…</div>
      </AthleteAppShell>
    );
  }

  if (wizardGoal && wizardGoal.race_registry && wizardGoal.raceRegistryId) {
    const rr = wizardGoal.race_registry;
    return (
      <AthleteAppShell>
        <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm sm:p-8">
            <h1 className="mb-2 text-2xl font-semibold tracking-tight">Plan setup</h1>
            <div className="mb-5 rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
              <p className="font-medium text-gray-900">We&apos;ll build your plan for you</p>
              <p className="mt-2 leading-relaxed text-gray-700">
                Next you&apos;ll set weekly miles, preferred training days, and we&apos;ll
                generate every workout. You just need a start date and baseline here.
              </p>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Goal:{" "}
              <span className="font-medium text-gray-900">{rr.name}</span> —{" "}
              {formatRaceWhen(rr.raceDate)} ({rr.raceType}). Baseline fields update your profile
              when you create the plan.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Current 5K pace
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    value={baseline5KPace}
                    onChange={(e) => setBaseline5KPace(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Weekly mileage
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    value={baselineWeeklyMileage}
                    onChange={(e) => setBaselineWeeklyMileage(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Plan start date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFormError(null);
                  }}
                />
              </div>

              {formError && <p className="text-sm text-amber-800">{formError}</p>}

              {replaceBlockPlan && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="mb-2 font-medium text-amber-950">
                    You already have an active plan for this goal
                  </p>
                  <p className="mb-3 text-amber-900/90">
                    Open it to keep your schedule, or replace it with a new plan (the current one
                    will be archived).
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/training-setup/${replaceBlockPlan.id}`)
                      }
                      className="inline-flex justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Open existing plan
                    </button>
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => void createPlan({ forceReplace: true })}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Replace with new plan
                    </button>
                  </div>
                </div>
              )}

              {createFeedback === "goals" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="mb-2 font-medium">Let&apos;s update your goal first</p>
                  <p className="mb-3 text-amber-900/90">
                    We couldn&apos;t start a plan from here—your goal or race may have changed, or
                    something needs to be finished in Goals. Nothing&apos;s wrong with your account;
                    just confirm your race and goal time, then try again.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link
                      href="/goals"
                      className="inline-flex justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Open Goals
                    </Link>
                    <button
                      type="button"
                      onClick={() => void refreshGoalsAndExitWizard()}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Refresh goal list
                    </button>
                  </div>
                </div>
              )}

              {createFeedback === "dates" && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <p className="mb-2 font-medium">Check your start date</p>
                  <p className="text-sky-900/90">
                    Your plan needs to start before race day. Pick an earlier date above, then tap
                    Create plan again.
                  </p>
                </div>
              )}

              {createFeedback === "generic" && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  <p className="mb-3">
                    We couldn&apos;t create your plan just now. Please try again in a moment.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateFeedback(null)}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => void createPlan()}
                disabled={creating}
                className="w-full rounded-lg bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create plan"}
              </button>

              <button
                type="button"
                onClick={exitWizard}
                className="block w-full text-center text-sm text-gray-500 hover:text-gray-800"
              >
                Back to goal selection
              </button>

              <Link href="/training" className="block text-center text-sm text-gray-500 hover:text-orange-600">
                Exit to My Training
              </Link>
            </div>
          </div>
        </div>
      </AthleteAppShell>
    );
  }

  return (
    <AthleteAppShell>
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm sm:p-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Training plan</h1>
          <p className="mb-6 text-base text-gray-600">
            We&apos;ll build your plan for you once you pick a goal—weekly miles, preferred
            days, then we generate the workouts. You need an active goal with a race and goal time.
          </p>

          {loadingOrientation && (
            <p className="text-sm text-gray-500">Loading your goals…</p>
          )}

          {orientationError && (
            <p className="mb-4 text-sm text-red-600">{orientationError}</p>
          )}

          {!loadingOrientation && activePlans.length > 0 && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="mb-1 font-medium text-emerald-900">Your active plan</p>
              <p className="mb-1 text-emerald-900/95">{activePlans[0].name}</p>
              {activePlans[0].race_registry?.name && (
                <p className="mb-3 text-xs text-emerald-800/90">
                  {activePlans[0].race_registry.name}
                  {scheduleReady(activePlans[0]) ? " · Schedule ready" : " · Not generated yet"}
                </p>
              )}
              <Link
                href={`/training-setup/${activePlans[0].id}`}
                className="mb-2 inline-flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
              >
                Continue to plan
              </Link>
              <p className="mt-3 text-xs text-emerald-800/80">
                Use the goals below only if you want a different goal. Creating another plan for the
                same goal will ask before replacing this one.
              </p>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length > 0 && (
            <ul className="mb-6 space-y-3">
              {qualifyingGoals.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                >
                  <div className="mb-2 font-medium text-gray-900">
                    {g.race_registry?.name ?? "Race"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {g.race_registry
                      ? `${formatRaceWhen(g.race_registry.raceDate)} · Goal time ${g.goalTime}`
                      : g.goalTime}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginWizardForGoal(g)}
                    className="mt-3 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                  >
                    Train for this goal
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && activeNeedsRace && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="mb-2 font-medium">Add a race to your goal</p>
              <p className="mb-3 text-amber-900/90">
                Your active goal does not have a race yet. Choose a race in Goals, then set a goal
                time.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && incompleteRaceNeedsTime && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="mb-2 font-medium">Finish your goal time</p>
              <p className="mb-3 text-amber-900/90">
                You have a race on your goal, but no goal time yet. Add a time in Goals before
                building a plan.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && signups.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-gray-800">Your race signups</h2>
              <p className="mb-3 text-xs text-gray-500">
                Set a goal (race + goal time) for one of these to unlock plan setup.
              </p>
              <ul className="space-y-2">
                {signups.map((s) => {
                  const r = s.race_registry;
                  if (!r) return null;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatRaceWhen(r.raceDate)} · {r.raceType}
                        </div>
                      </div>
                      <Link
                        href={`/goals?raceRegistryId=${encodeURIComponent(s.raceRegistryId)}`}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Set goal for this race
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!loadingOrientation &&
            qualifyingGoals.length === 0 &&
            signups.length === 0 &&
            !incompleteRaceNeedsTime &&
            !activeNeedsRace && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="mb-3">
                  No active goal with a race and goal time yet, and no race signups. Add a race in
                  Goals (or sign up for a race), set your goal time, then come back here.
                </p>
                <Link
                  href="/goals"
                  className="inline-block rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Go to Goals
                </Link>
              </div>
            )}

          <div className="border-t border-gray-200 pt-4 text-center">
            <Link href="/goals" className="text-sm text-gray-500 hover:text-orange-600">
              Manage goals
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href="/training" className="text-sm text-gray-500 hover:text-orange-600">
              Back to My Training
            </Link>
          </div>
        </div>
      </div>
    </AthleteAppShell>
  );
}
