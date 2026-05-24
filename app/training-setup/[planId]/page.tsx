"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import PlanWeekCalendar from "@/components/training/PlanWeekCalendar";
import {
  parsePhasesJson,
  phaseNameForWeek,
  type PhaseRange,
} from "@/lib/training/plan-phases";
import { cataloguePhaseFallbackForWeek, localTodayKey } from "@/lib/training/plan-utils";
import {
  effectiveTrainingWeekCount,
  formatCalendarWeekRangeLabel,
  formatPlanDateDisplay,
} from "@/lib/training/plan-utils";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { validatePreferredTempoInterval } from "@/lib/training/preferred-tempo-interval";
import { isStructuredPlanWeek, type PlanDaySchedule } from "@/lib/training/plan-schedule-schema";
import { buildWeekSummary } from "@/lib/training/week-summary-service";
import {
  formatWeekCardMiles,
  workoutCardPrimaryName,
  workoutCardSubtypeLine,
} from "@/lib/training/plan-day-card-display";

type PlanWeekRow =
  | { weekNumber: number; phase: string; schedule: string }
  | {
      weekNumber: number;
      phase: string;
      structuredDays: Array<{
        dow: number;
        miles: number;
        workoutType: string;
        planCycleIndex: number | null;
      }>;
    };

type PlanPresetSummary = {
  id: string;
  slug: string | null;
  title: string;
  minWeeklyMiles?: number | null;
  intervalsConfig: { positions: unknown[] } | null;
  tempoConfig: { positions: unknown[] } | null;
} | null;

type PlanDetail = {
  id: string;
  presetId?: string | null;
  name: string;
  totalWeeks: number;
  startDate: string;
  phases: unknown;
  planSchedule?: unknown;
  preferredDays: number[];
  preferredLongRunDow?: number | null;
  preferredTempoDow?: number | null;
  preferredIntervalDow?: number | null;
  /** Legacy; used only to hydrate UI when new columns are empty */
  preferredQualityDays?: number[];
  weeklyMileageTarget?: number | null;
  currentWeeklyMileage?: number | null;
  _count?: { planned_workouts: number };
  race_registry: {
    name: string;
    raceDate: string;
  } | null;
  training_plan_preset?: PlanPresetSummary | null;
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


function parsePlanWeekOverviewRows(planSchedule: unknown): PlanWeekRow[] {
  if (!Array.isArray(planSchedule)) return [];
  const out: PlanWeekRow[] = [];
  for (const w of planSchedule) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    const weekNumber = Number(o.weekNumber);
    if (!Number.isFinite(weekNumber)) continue;
    const phaseRaw = typeof o.phase === "string" ? o.phase : String(o.phase ?? "");
    if (isStructuredPlanWeek(w)) {
      const structuredDays = ((w.days as PlanDaySchedule[]) ?? []).map((d) => ({
        dow: d.dow,
        miles: typeof d.miles === "number" ? d.miles : 0,
        workoutType: d.workoutType,
        planCycleIndex: d.planCycleIndex ?? null,
      }));
      out.push({ weekNumber, phase: phaseRaw, structuredDays });
    } else {
      const schedule = typeof o.schedule === "string" ? o.schedule : "";
      out.push({ weekNumber, phase: phaseRaw, schedule });
    }
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekNumber, setWeekNumber] = useState(1);
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [preferredDaysLocal, setPreferredDaysLocal] = useState<number[]>([]);
  const [weeklyMilesTarget, setWeeklyMilesTarget] = useState("");
  const [preferredLongRunDowLocal, setPreferredLongRunDowLocal] = useState(6);
  const [preferredTempoDowLocal, setPreferredTempoDowLocal] = useState<number | null>(null);
  const [preferredIntervalDowLocal, setPreferredIntervalDowLocal] = useState<number | null>(
    null
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
    setWeeklyMilesTarget("");
    const pld = plan.preferredLongRunDow;
    if (pld === 6 || pld === 7) {
      setPreferredLongRunDowLocal(pld);
    } else {
      setPreferredLongRunDowLocal(6);
    }
    let tempo = plan.preferredTempoDow ?? null;
    let interval = plan.preferredIntervalDow ?? null;
    if (
      tempo == null &&
      interval == null &&
      Array.isArray(plan.preferredQualityDays) &&
      plan.preferredQualityDays.length > 0
    ) {
      const q = [...plan.preferredQualityDays]
        .filter((n) => n >= 1 && n <= 7)
        .sort((a, b) => a - b);
      if (q.length >= 1) tempo = q[0]!;
      if (q.length >= 2) interval = q[1]!;
    }
    setPreferredTempoDowLocal(tempo);
    setPreferredIntervalDowLocal(interval);
  }, [
    plan?.id,
    plan?.preferredDays,
    plan?.preferredLongRunDow,
    plan?.preferredTempoDow,
    plan?.preferredIntervalDow,
    plan?.preferredQualityDays,
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

  const effectiveTotalWeeks = useMemo(() => {
    if (!plan) return 1;
    return effectiveTrainingWeekCount(
      new Date(plan.startDate),
      plan.totalWeeks,
      plan.race_registry?.raceDate
        ? new Date(plan.race_registry.raceDate)
        : null
    );
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    setWeekNumber((wn) => Math.min(wn, effectiveTotalWeeks));
  }, [plan?.id, effectiveTotalWeeks]);

  const weekEntries = useMemo(() => {
    if (!plan) return [];
    const raw = parsePlanWeekOverviewRows(plan.planSchedule);
    const race = plan.race_registry;
    if (!race) return raw;
    return raw.map((w) => ({
      ...w,
      phase:
        w.phase.trim() !== ""
          ? w.phase
          : cataloguePhaseFallbackForWeek(plan.startDate, race.raceDate, w.weekNumber),
    }));
  }, [plan]);

  const hasPlanSchedulePersisted = useMemo(() => {
    if (!plan?.planSchedule) return false;
    return Array.isArray(plan.planSchedule) && plan.planSchedule.length > 0;
  }, [plan?.planSchedule]);
  const hasSchedule = hasPlanSchedulePersisted;

  const preferredCount = useMemo(
    () => preferredDaysLocal.filter((d) => d >= 1 && d <= 7).length,
    [preferredDaysLocal]
  );

  const presetMinWeeklyMiles = useMemo(() => {
    const raw = plan?.training_plan_preset?.minWeeklyMiles;
    if (raw != null && Number.isFinite(Number(raw))) {
      return Math.max(1, Math.round(Number(raw)));
    }
    return 40;
  }, [plan?.training_plan_preset?.minWeeklyMiles]);

  const buildWarnings = useMemo(() => {
    const miles = Math.round(Number(weeklyMilesTarget));
    const milesFinite = Number.isFinite(miles);
    const belowEngineFloor =
      milesFinite &&
      miles < presetMinWeeklyMiles &&
      weeklyMilesTarget.trim() !== "";
    const fewDays = preferredCount > 0 && preferredCount < 4;
    const fourDays = preferredCount === 4;
    return { belowEngineFloor, fewDays, fourDays };
  }, [weeklyMilesTarget, preferredCount, presetMinWeeklyMiles]);

  const presetGenerateWarnings = useMemo(() => {
    if (!plan || hasSchedule) return [] as string[];
    const msgs: string[] = [];
    const preset = plan.training_plan_preset;
    if (!plan.presetId) {
      msgs.push(
        "This plan has no training preset assigned. Ask your coach to pick a blueprint for this plan in GoFast Company, or archive it and create a new plan from training setup (choose a published level there)."
      );
    } else if (preset == null) {
      msgs.push(
        "This plan points at a preset that could not be loaded (it may have been removed). Try generating once; contact support if you still see preset errors."
      );
    }
    if (
      preset != null &&
      (preset.intervalsConfig == null || !preset.intervalsConfig.positions?.length)
    ) {
      msgs.push(
        "Your preset has no interval rotation configured. Weekly plans may omit interval workouts until rotations are set up."
      );
    }
    if (
      preset != null &&
      (preset.tempoConfig == null || !preset.tempoConfig.positions?.length)
    ) {
      msgs.push(
        "Your preset has no tempo rotation configured. Weekly plans may omit tempo workouts until rotations are set up."
      );
    }
    return msgs;
  }, [plan, hasSchedule]);

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
    return formatCalendarWeekRangeLabel(plan.startDate, weekNumber, {
      raceDate: plan.race_registry?.raceDate ?? null,
      totalWeeks: effectiveTotalWeeks,
    });
  }, [plan, weekNumber, effectiveTotalWeeks]);

  const fetchWeekWorkouts = useCallback(
    async (wn: number) => {
      setLoadingWeek(true);
      setError(null);
      try {
        const token = await getToken();
        const { days } = await fetchPlanWeekSchedule(planId, wn, token);
        setWeekDays(days);
        const today = localTodayKey();
        setSelectedDayKey((prev) => {
          if (days.some((d) => d.dateKey === prev)) return prev;
          if (days.some((d) => d.dateKey === today)) return today;
          return days[0]?.dateKey ?? today;
        });
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
      let next: number[];
      if (prev.includes(d)) {
        next = prev.filter((x) => x !== d);
      } else {
        next = [...prev, d].sort((a, b) => a - b);
      }
      setPreferredTempoDowLocal((t) => (t != null && !next.includes(t) ? null : t));
      setPreferredIntervalDowLocal((i) => (i != null && !next.includes(i) ? null : i));
      return next;
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
      const weeklyMilesRaw = weeklyMilesTarget.trim();
      let targetMiles = weeklyMilesRaw === "" ? NaN : Math.round(Number(weeklyMilesRaw));
      if (!Number.isFinite(targetMiles)) {
        setError("Please enter a number for your weekly miles.");
        return;
      }
      targetMiles = Math.max(25, Math.min(100, targetMiles));

      const prefCheck = validatePreferredTempoInterval({
        preferredTempoDow: preferredTempoDowLocal,
        preferredIntervalDow: preferredIntervalDowLocal,
        preferredLongRunDow: preferredLongRunDowLocal,
        preferredDays: normalized,
      });
      if (!prefCheck.ok) {
        setError(prefCheck.error);
        return;
      }

      const patchRes = await fetch(`/api/training-plan/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          preferredDays: normalized,
          weeklyMileageTarget: targetMiles,
          preferredLongRunDow: preferredLongRunDowLocal,
          preferredTempoDow: preferredTempoDowLocal,
          preferredIntervalDow: preferredIntervalDowLocal,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        setError(patchData.error || "Could not save preferences");
        return;
      }

      const genRes = await fetch("/api/training/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          trainingPlanId: planId,
          weeklyMileageTarget: targetMiles,
          minWeeklyMiles: presetMinWeeklyMiles,
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

  async function regenerateSchedule() {
    if (!plan) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const fromPlan =
        plan.weeklyMileageTarget != null &&
        Number.isFinite(Number(plan.weeklyMileageTarget))
          ? Math.round(Number(plan.weeklyMileageTarget))
          : null;
      const fromInput = Math.round(Number(weeklyMilesTarget));
      const targetMiles = Math.max(
        25,
        Math.min(100, fromPlan ?? (Number.isFinite(fromInput) ? fromInput : 45))
      );

      const genRes = await fetch("/api/training/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          trainingPlanId: planId,
          weeklyMileageTarget: targetMiles,
          minWeeklyMiles: presetMinWeeklyMiles,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error || "Regeneration failed");
        return;
      }
      await loadPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setGenerating(false);
    }
  }

  function goPrevWeek() {
    setWeekNumber((n) => Math.max(1, n - 1));
  }

  function goNextWeek() {
    if (!plan) return;
    setWeekNumber((n) => Math.min(effectiveTotalWeeks, n + 1));
  }

  const todayKey = localTodayKey();
  const focusKey = selectedDayKey || todayKey;
  const focusPlanDay = weekDays.find((d) => d.dateKey === focusKey) ?? null;

  const weekSummary = useMemo(() => {
    if (!weekDays.length) return null;
    return buildWeekSummary({
      weekNumber,
      totalWeeks: effectiveTotalWeeks,
      days: weekDays,
      weekPhaseLabel: weekPhaseLabel,
    });
  }, [weekDays, weekNumber, effectiveTotalWeeks, weekPhaseLabel]);

  function openPlanDay(day: PlanDayCard) {
    setSelectedDayKey(day.dateKey);
  }

  function navigateToPlanDay(day: PlanDayCard) {
    if (!plan) return;
    router.push(
      `/training/day/${day.dateKey}?planId=${encodeURIComponent(plan.id)}&source=setup`
    );
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
            {effectiveTotalWeeks} weeks · Start{" "}
            {formatPlanDateDisplay(plan.startDate)}
          </p>

          {!hasSchedule && (
            <div className="mb-6 space-y-6">
              <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">
                  Choose your training preferences
                </p>
                <p className="mt-2 leading-relaxed text-gray-700">
                  Tell us roughly how many miles you want in a typical week and
                  which days you like to run. We use that to size the plan before we
                  generate your schedule. Each week won&apos;t match that number
                  exactly—long-run weeks, taper, and recovery will move weekly volume
                  up and down.
                </p>
              </div>

              {presetGenerateWarnings.length > 0 && (
                <div
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  <p className="mb-2 font-medium text-amber-950">
                    Before you continue
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-amber-900/95">
                    {presetGenerateWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                    This plan&apos;s blueprint enforces at least {presetMinWeeklyMiles}{" "}
                    mi/week when we build the schedule, so the generator may use that
                    minimum (or higher) for weekly totals—especially on weeks with
                    quality and long runs.
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
                    interval/tempo days, and recovery. Adding another day or two usually
                    feels better on the legs.
                  </p>
                )}
                {buildWarnings.fourDays && (
                  <p
                    className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950"
                    role="status"
                  >
                    With four sessions a week, your off days are real recovery
                    days—we aim to make each workout day count (tempo, intervals,
                    long, or easy). Listen to easy days if we prescribe them.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">
                  Long run day
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  Pick Saturday or Sunday for your long run. Interval and tempo days avoid
                  this day.
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
                        onChange={() => {
                          setPreferredLongRunDowLocal(value);
                          setPreferredTempoDowLocal((t) => (t === value ? null : t));
                          setPreferredIntervalDowLocal((i) => (i === value ? null : i));
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">Tempo day</p>
                <p className="mb-3 text-xs text-gray-500">
                  Pick a day for your tempo workout (from your preferred days, not your long run).
                  If you skip this, we use the preset default (often Tuesday).
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                    <input
                      type="radio"
                      name="preferredTempoDow"
                      className="border-gray-300 text-orange-600 focus:ring-orange-500"
                      checked={preferredTempoDowLocal === null}
                      onChange={() => {
                        setPreferredTempoDowLocal(null);
                        setError(null);
                      }}
                    />
                    No preference
                  </label>
                  {DAY_OPTIONS.map(({ value, label }) => {
                    const ok =
                      preferredDaysLocal.includes(value) &&
                      value !== preferredLongRunDowLocal &&
                      value !== preferredIntervalDowLocal;
                    return (
                      <label
                        key={`tempo-${value}`}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm ${
                          ok
                            ? "cursor-pointer border-gray-200 bg-gray-50 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
                            : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="preferredTempoDow"
                          className="border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-40"
                          checked={preferredTempoDowLocal === value}
                          disabled={!ok}
                          onChange={() => {
                            setPreferredTempoDowLocal(value);
                            setPreferredIntervalDowLocal((i) => (i === value ? null : i));
                            setError(null);
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">Interval day</p>
                <p className="mb-3 text-xs text-gray-500">
                  Pick a day for intervals (from your preferred days, not your long run).
                  If you skip this, we use the preset default (often Thursday). When both tempo and
                  interval are set, they must be at least two weekdays apart.
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                    <input
                      type="radio"
                      name="preferredIntervalDow"
                      className="border-gray-300 text-orange-600 focus:ring-orange-500"
                      checked={preferredIntervalDowLocal === null}
                      onChange={() => {
                        setPreferredIntervalDowLocal(null);
                        setError(null);
                      }}
                    />
                    No preference
                  </label>
                  {DAY_OPTIONS.map(({ value, label }) => {
                    const ok =
                      preferredDaysLocal.includes(value) &&
                      value !== preferredLongRunDowLocal &&
                      value !== preferredTempoDowLocal;
                    return (
                      <label
                        key={`interval-${value}`}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm ${
                          ok
                            ? "cursor-pointer border-gray-200 bg-gray-50 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
                            : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="preferredIntervalDow"
                          className="border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-40"
                          checked={preferredIntervalDowLocal === value}
                          disabled={!ok}
                          onChange={() => {
                            setPreferredIntervalDowLocal(value);
                            setPreferredTempoDowLocal((t) => (t === value ? null : t));
                            setError(null);
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void savePreferredAndGenerate()}
                disabled={generating}
                className="w-full rounded-lg bg-orange-500 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
              >
                {generating
                  ? "Saving preferences & generating schedule…"
                  : "Save preferences & generate schedule"}
              </button>
            </div>
          )}

          {hasSchedule && (
            <>
              <p className="mb-4 text-base text-gray-700">
                Your schedule is ready. Step through weeks below and open each
                workout.
              </p>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void regenerateSchedule()}
                  disabled={generating}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  {generating ? "Regenerating…" : "Regenerate schedule"}
                </button>
                <Link
                  href="/training"
                  className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Go to my plan
                </Link>
              </div>

              <PlanWeekCalendar
                weekNumber={weekNumber}
                totalWeeks={effectiveTotalWeeks}
                days={weekDays}
                loading={loadingWeek}
                todayKey={todayKey}
                selectedDateKey={focusKey}
                calendarRangeLabel={calendarWeekRangeLabel}
                summary={weekSummary}
                onPrevWeek={goPrevWeek}
                onNextWeek={goNextWeek}
                onSelectDay={openPlanDay}
                selectedDayDetail={
                  focusPlanDay ? (
                    <div className="rounded-xl border border-orange-200 bg-white p-4 sm:p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Selected workout
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900">
                        {workoutCardPrimaryName(focusPlanDay)}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatPlanDateDisplay(focusPlanDay.dateKey || focusPlanDay.date, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                        {focusPlanDay.estimatedDistanceInMeters
                          ? ` · ${formatWeekCardMiles(focusPlanDay.estimatedDistanceInMeters)}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {workoutCardSubtypeLine(focusPlanDay)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigateToPlanDay(focusPlanDay)}
                          className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                        >
                          Open workout
                        </button>
                        {focusPlanDay.workoutId ? (
                          <Link
                            href={`/workouts/${focusPlanDay.workoutId}`}
                            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                          >
                            Workout detail
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null
                }
              />
            </>
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
              Workouts
            </Link>
          </div>
        </div>
      </div>

    </AthleteAppShell>
  );
}
