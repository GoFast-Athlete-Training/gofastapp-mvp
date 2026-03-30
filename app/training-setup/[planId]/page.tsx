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
import { cataloguePhaseFallbackForWeek } from "@/lib/training/generate-plan";
import {
  formatCalendarWeekRangeLabel,
  formatPlanDateDisplay,
} from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  resolveWorkoutForPlanDay,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  phases: unknown;
  planWeeks: unknown;
  preferredDays: number[];
  preferredLongRunDow?: number | null;
  weeklyMileageTarget?: number | null;
  currentWeeklyMileage?: number | null;
  _count?: { planned_workouts: number };
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

const LONG_RUN_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

/** Matches generator default floor; not user-editable. */
const ENGINE_MIN_WEEKLY_MI = 40;

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
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [openingDayKey, setOpeningDayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekNumber, setWeekNumber] = useState(1);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [preferredDaysLocal, setPreferredDaysLocal] = useState<number[]>([]);
  const [weeklyMilesTarget, setWeeklyMilesTarget] = useState("50");
  const [preferredLongRunDowLocal, setPreferredLongRunDowLocal] = useState(6);
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
      const { plan } = await fetchTrainingPlanDetail(planId, token);
      setPlan(plan as PlanDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setPlan(null);
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
      setPreferredDaysLocal([]);
    }
    const fromPlan =
      plan.weeklyMileageTarget ?? plan.currentWeeklyMileage ?? null;
    if (fromPlan != null && Number.isFinite(Number(fromPlan))) {
      setWeeklyMilesTarget(String(Math.round(Number(fromPlan))));
    } else {
      setWeeklyMilesTarget("50");
    }
    const pld = plan.preferredLongRunDow;
    if (pld === 6 || pld === 7) {
      setPreferredLongRunDowLocal(pld);
    } else {
      setPreferredLongRunDowLocal(6);
    }
  }, [
    plan?.id,
    plan?.preferredDays,
    plan?.preferredLongRunDow,
    plan?.weeklyMileageTarget,
    plan?.currentWeeklyMileage,
  ]);

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

  const phaseRanges: PhaseRange[] = useMemo(
    () => (plan ? parsePhasesJson(plan.phases) : []),
    [plan?.phases]
  );

  const weekEntries = useMemo(() => {
    if (!plan) return [];
    const raw = parsePlanWeekEntries(plan.planWeeks);
    const race = plan.race_registry;
    if (!race) return raw;
    return raw.map((w) => ({
      ...w,
      phase:
        w.phase.trim() ||
        cataloguePhaseFallbackForWeek(plan.startDate, race.raceDate, w.weekNumber),
    }));
  }, [plan]);

  const hasLegacyPlanWeeks = useMemo(() => {
    if (!plan?.planWeeks) return false;
    return Array.isArray(plan.planWeeks) && plan.planWeeks.length > 0;
  }, [plan?.planWeeks]);
  const hasSchedule = hasLegacyPlanWeeks;

  const showPhaseModalButton =
    phaseRanges.length > 0 || weekEntries.length > 0;

  const preferredCount = useMemo(
    () => preferredDaysLocal.filter((d) => d >= 1 && d <= 7).length,
    [preferredDaysLocal]
  );

  const buildWarnings = useMemo(() => {
    const miles = Math.round(Number(weeklyMilesTarget));
    const milesFinite = Number.isFinite(miles);
    const belowEngineFloor =
      milesFinite &&
      miles < ENGINE_MIN_WEEKLY_MI &&
      weeklyMilesTarget.trim() !== "";
    const fewDays = preferredCount > 0 && preferredCount < 4;
    const fourDays = preferredCount === 4;
    return { belowEngineFloor, fewDays, fourDays };
  }, [weeklyMilesTarget, preferredCount]);

  const currentWeekEntry = useMemo(
    () => weekEntries.find((w) => w.weekNumber === weekNumber),
    [weekEntries, weekNumber]
  );

  const weekPhaseLabel = useMemo(() => {
    const fromWeek = currentWeekEntry?.phase?.trim();
    const catalogue =
      plan?.race_registry != null
        ? cataloguePhaseFallbackForWeek(
            plan.startDate,
            plan.race_registry.raceDate,
            weekNumber
          )
        : "";
    return phaseNameForWeek(phaseRanges, weekNumber, fromWeek || catalogue);
  }, [
    phaseRanges,
    weekNumber,
    currentWeekEntry,
    plan?.race_registry,
    plan?.startDate,
  ]);

  const calendarWeekRangeLabel = useMemo(() => {
    if (!plan) return "";
    return formatCalendarWeekRangeLabel(plan.startDate, weekNumber);
  }, [plan, weekNumber]);

  const fetchWeekWorkouts = useCallback(
    async (wn: number) => {
      setLoadingWeek(true);
      setError(null);
      try {
        const token = await getToken();
        const { days } = await fetchPlanWeekSchedule(planId, wn, token);
        setWeekDays(days);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Week load failed");
        setWeekDays([]);
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
        return prev.filter((x) => x !== d);
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
      let targetMiles = Math.round(Number(weeklyMilesTarget));
      if (!Number.isFinite(targetMiles)) {
        setError("Please enter a number for your weekly miles.");
        return;
      }
      targetMiles = Math.max(25, Math.min(100, targetMiles));

      const patchRes = await fetch(`/api/training-plan/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferredDays: normalized,
          weeklyMileageTarget: targetMiles,
          preferredLongRunDow: preferredLongRunDowLocal,
        }),
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
        body: JSON.stringify({
          trainingPlanId: planId,
          weeklyMileageTarget: targetMiles,
          minWeeklyMiles: ENGINE_MIN_WEEKLY_MI,
        }),
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

  async function openPlanDay(day: PlanDayCard) {
    const u = auth.currentUser;
    if (!u || !plan) return;
    try {
      setOpeningDayKey(day.dateKey);
      const token = await u.getIdToken();
      const id =
        day.workoutId ??
        (await resolveWorkoutForPlanDay(plan.id, day.dateKey, token));
      router.push(`/workouts/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningDayKey(null);
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
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm sm:p-8">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">
            {plan.name}
          </h1>
          {plan.race_registry && (
            <p className="mb-4 text-sm text-gray-600">
              Race: {plan.race_registry.name} —{" "}
              {formatPlanDateDisplay(plan.race_registry.raceDate)}
            </p>
          )}
          <p className="mb-4 text-sm text-gray-600">
            {plan.totalWeeks} weeks · Start{" "}
            {formatPlanDateDisplay(plan.startDate)}
          </p>

          {!hasSchedule && (
            <div className="mb-6 space-y-6">
              <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">
                  We&apos;ll build your plan for you
                </p>
                <p className="mt-2 leading-relaxed text-gray-700">
                  Tell us roughly how many miles you want in a typical week and
                  which days you like to run. We use that to size the plan. Each
                  week won&apos;t match that number exactly—long-run weeks, taper,
                  and recovery will move weekly volume up and down.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  How many miles do you want to do weekly?
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Your ballpark for how much you want to run in a normal week—we
                  aim the plan at it.
                </p>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  value={weeklyMilesTarget}
                  onChange={(e) => setWeeklyMilesTarget(e.target.value)}
                />
                {buildWarnings.belowEngineFloor && (
                  <p
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
                    role="status"
                  >
                    You entered {Math.round(Number(weeklyMilesTarget))} mi/week.
                    Our planner won&apos;t schedule a week below{" "}
                    {ENGINE_MIN_WEEKLY_MI} mi, so some weeks may land a few miles
                    above what you typed—we still try to stay near your target
                    when we can.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">
                  Preferred training days
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  Choose the days you want to train. We assign sessions on these
                  days (Mon–Sun).
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
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
                {buildWarnings.fewDays && (
                  <p
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
                    role="status"
                  >
                    Fewer than four days makes it harder to spread easy mileage,
                    quality work, and recovery. Adding another day or two usually
                    feels better on the legs.
                  </p>
                )}
                {buildWarnings.fourDays && (
                  <p
                    className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950"
                    role="status"
                  >
                    With four sessions a week, your off days are real recovery
                    days—we&apos;ll treat most runs as quality so something
                    meaningful happens every time you lace up. Listen to easy
                    days if we prescribe them.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">
                  Long run day
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  Tempo is Tuesday, intervals Thursday; pick Saturday or Sunday for
                  your long run.
                </p>
                <div className="flex flex-wrap gap-3">
                  {LONG_RUN_DAY_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
                    >
                      <input
                        type="radio"
                        name="preferredLongRunDow"
                        className="border-gray-300 text-orange-600 focus:ring-orange-500"
                        checked={preferredLongRunDowLocal === value}
                        onChange={() => setPreferredLongRunDowLocal(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void savePreferredAndGenerate()}
                disabled={generating}
                className="w-full rounded-lg bg-orange-500 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
              >
                {generating ? "Building your plan…" : "Build my plan"}
              </button>
            </div>
          )}

          {hasSchedule && (
            <>
              <p className="mb-4 text-base text-gray-700">
                Your schedule is ready. Step through weeks below and open each
                workout.
              </p>

              {showPhaseModalButton && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPhaseModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <LayoutList className="h-4 w-4" aria-hidden />
                    View plan overview
                  </button>
                </div>
              )}

              <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Week preview
                    </p>
                    <p className="text-lg font-semibold text-gray-900 sm:text-xl">
                      Week {weekNumber} of {plan.totalWeeks}
                    </p>
                    {weekPhaseLabel && (
                      <span className="mt-1 inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                        {weekPhaseLabel}
                      </span>
                    )}
                    {calendarWeekRangeLabel && (
                      <p className="mt-2 text-sm text-gray-500">
                        Calendar week: {calendarWeekRangeLabel}
                      </p>
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
                {weekDays.length > 0 ? (
                  <div className="mt-1">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      This week
                    </p>
                    <ul className="space-y-2">
                      {weekDays.map((w) => (
                        <li
                          key={w.dateKey}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"
                        >
                          <span className="font-medium text-gray-900">
                            {displayWorkoutListTitle(w)}
                          </span>
                          <span className="text-gray-500">
                            {w.date
                              ? formatPlanDateDisplay(w.date, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : loadingWeek ? (
                  <p className="text-sm leading-relaxed text-gray-600">
                    Loading this week&apos;s sessions…
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    No sessions scheduled for this week.
                  </p>
                )}
                {loadingWeek && (
                  <p className="mt-2 text-xs text-gray-500">Loading workouts…</p>
                )}
              </div>
            </>
          )}

          {weekDays.length > 0 && (
            <ul className="space-y-3 mb-6">
              {weekDays.map((w) => (
                <li key={w.dateKey}>
                  <button
                    type="button"
                    disabled={openingDayKey === w.dateKey}
                    onClick={() => void openPlanDay(w)}
                    className="block w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-orange-300 hover:shadow-md transition disabled:opacity-50"
                  >
                    <div className="text-base font-semibold text-gray-900 leading-snug">
                      {displayWorkoutListTitle(w)}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {w.date
                        ? formatPlanDateDisplay(w.date, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Date TBD"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasSchedule && !loadingWeek && weekDays.length === 0 && (
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
              My Training
            </Link>
            <Link href="/workouts" className="hover:text-orange-600">
              Go Train
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
