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
      const [gRes, sRes] = await Promise.all([
        fetch("/api/goals?status=ACTIVE", { headers }),
        fetch("/api/race-signups", { headers }),
      ]);
      const gJson = await gRes.json();
      const sJson = await sRes.json();
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
    const today = new Date();
    setStartDate(today.toISOString().split("T")[0]);
    router.replace(`/training-setup?goalId=${encodeURIComponent(g.id)}`, { scroll: false });
  }

  function exitWizard() {
    setWizardGoal(null);
    setFormError(null);
    setCreateFeedback(null);
    router.replace("/training-setup", { scroll: false });
  }

  async function refreshGoalsAndExitWizard() {
    setCreateFeedback(null);
    await loadOrientation();
    exitWizard();
  }

  async function createPlan() {
    if (!wizardGoal?.race_registry || !wizardGoal.raceRegistryId) {
      setFormError(null);
      setCreateFeedback("goals");
      return;
    }
    if (!startDate) {
      setFormError("Pick a start date for your plan.");
      return;
    }
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
        <div className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-slate-950 p-6 text-slate-100 shadow-lg">
            <h1 className="mb-2 text-2xl font-semibold">Plan setup</h1>
            <p className="mb-6 text-sm text-slate-400">
              Building a plan for your goal:{" "}
              <span className="text-slate-200">{rr.name}</span> —{" "}
              {formatRaceWhen(rr.raceDate)} ({rr.raceType}). Baseline fields update your profile
              when you create the plan.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Current 5K pace
                  </label>
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    value={baseline5KPace}
                    onChange={(e) => setBaseline5KPace(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Weekly mileage
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    value={baselineWeeklyMileage}
                    onChange={(e) => setBaselineWeeklyMileage(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Plan start date</label>
                <input
                  type="date"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFormError(null);
                  }}
                />
              </div>

              {formError && <p className="text-sm text-amber-200">{formError}</p>}

              {createFeedback === "goals" && (
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/35 p-4 text-sm text-amber-50">
                  <p className="mb-2 font-medium text-amber-100">
                    Let&apos;s update your goal first
                  </p>
                  <p className="mb-3 text-amber-100/85">
                    We couldn&apos;t start a plan from here—your goal or race may have changed, or
                    something needs to be finished in Goals. Nothing&apos;s wrong with your account;
                    just confirm your race and goal time, then try again.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link
                      href="/goals"
                      className="inline-flex justify-center rounded bg-amber-500 px-4 py-2 text-center text-sm font-medium text-slate-950 hover:bg-amber-400"
                    >
                      Open Goals
                    </Link>
                    <button
                      type="button"
                      onClick={() => void refreshGoalsAndExitWizard()}
                      className="rounded border border-amber-700/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-slate-900"
                    >
                      Refresh goal list
                    </button>
                  </div>
                </div>
              )}

              {createFeedback === "dates" && (
                <div className="rounded-lg border border-sky-900/60 bg-sky-950/35 p-4 text-sm text-sky-50">
                  <p className="mb-2 font-medium text-sky-100">Check your start date</p>
                  <p className="text-sky-100/85">
                    Your plan needs to start before race day. Pick an earlier date above, then tap
                    Create plan again.
                  </p>
                </div>
              )}

              {createFeedback === "generic" && (
                <div className="rounded-lg border border-slate-600 bg-slate-900/60 p-4 text-sm text-slate-200">
                  <p className="mb-3">
                    We couldn&apos;t create your plan just now. Please try again in a moment.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateFeedback(null)}
                    className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={createPlan}
                disabled={creating}
                className="w-full rounded bg-emerald-600 py-3 font-medium disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create plan"}
              </button>

              <button
                type="button"
                onClick={exitWizard}
                className="block w-full text-center text-sm text-slate-500 hover:text-slate-300"
              >
                Back to goal selection
              </button>

              <Link href="/training" className="block text-center text-sm text-slate-600">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </AthleteAppShell>
    );
  }

  return (
    <AthleteAppShell>
      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-slate-950 p-6 text-slate-100 shadow-lg">
          <h1 className="mb-2 text-2xl font-semibold">Training plan</h1>
          <p className="mb-6 text-sm text-slate-400">
            We start from an active goal with a race and goal time. Pick the goal you are training
            for, or finish a goal in Goals first.
          </p>

          {loadingOrientation && (
            <p className="text-sm text-slate-500">Loading your goals…</p>
          )}

          {orientationError && (
            <p className="mb-4 text-sm text-red-400">{orientationError}</p>
          )}

          {!loadingOrientation && qualifyingGoals.length > 0 && (
            <ul className="mb-6 space-y-3">
              {qualifyingGoals.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
                >
                  <div className="mb-2 font-medium text-slate-100">
                    {g.race_registry?.name ?? "Race"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {g.race_registry
                      ? `${formatRaceWhen(g.race_registry.raceDate)} · Goal time ${g.goalTime}`
                      : g.goalTime}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginWizardForGoal(g)}
                    className="mt-3 w-full rounded bg-amber-500 py-2 text-sm font-medium text-slate-950"
                  >
                    Train for this goal
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && activeNeedsRace && (
            <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100">
              <p className="mb-2 font-medium">Add a race to your goal</p>
              <p className="mb-3 text-amber-100/80">
                Your active goal does not have a race yet. Choose a race in Goals, then set a goal
                time.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && incompleteRaceNeedsTime && (
            <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100">
              <p className="mb-2 font-medium">Finish your goal time</p>
              <p className="mb-3 text-amber-100/80">
                You have a race on your goal, but no goal time yet. Add a time in Goals before
                building a plan.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && signups.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-slate-300">Your race signups</h2>
              <p className="mb-3 text-xs text-slate-500">
                Set a goal (race + goal time) for one of these to unlock plan setup.
              </p>
              <ul className="space-y-2">
                {signups.map((s) => {
                  const r = s.race_registry;
                  if (!r) return null;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-200">{r.name}</div>
                        <div className="text-xs text-slate-500">
                          {formatRaceWhen(r.raceDate)} · {r.raceType}
                        </div>
                      </div>
                      <Link
                        href={`/goals?raceRegistryId=${encodeURIComponent(s.raceRegistryId)}`}
                        className="shrink-0 rounded bg-slate-700 px-3 py-2 text-center text-sm font-medium text-slate-100 hover:bg-slate-600"
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
              <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                <p className="mb-3">
                  No active goal with a race and goal time yet, and no race signups. Add a race in
                  Goals (or sign up for a race), set your goal time, then come back here.
                </p>
                <Link
                  href="/goals"
                  className="inline-block rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950"
                >
                  Go to Goals
                </Link>
              </div>
            )}

          <div className="border-t border-slate-800 pt-4 text-center">
            <Link href="/goals" className="text-sm text-slate-500 hover:text-slate-300">
              Manage goals
            </Link>
            <span className="mx-2 text-slate-700">·</span>
            <Link href="/training" className="text-sm text-slate-500 hover:text-slate-300">
              Back to Training
            </Link>
          </div>
        </div>
      </div>
    </AthleteAppShell>
  );
}
