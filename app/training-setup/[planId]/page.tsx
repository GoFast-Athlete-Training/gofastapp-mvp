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

function dayLabelsFromValues(values: number[]): string {
  return values
    .map((v) => DAY_OPTIONS.find((d) => d.value === v)?.label ?? String(v))
    .join(", ");
}

function longRunDayLabel(dow: number | null | undefined): string {
  return LONG_RUN_DAY_OPTIONS.find((d) => d.value === dow)?.label ?? "Saturday";
}


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
  const [showPreferencesEditor, setShowPreferencesEditor] = useState(false);
  const [regenerationSuccess, setRegenerationSuccess] = useState(false);
  /** Bumped after generate/regenerate so week fetch uses fresh planSchedule. */
  const [planScheduleEpoch, setPlanScheduleEpoch] = useState(0);
  const [athleteWeeklyTargetPreference, setAthleteWeeklyTargetPreference] = useState<
    number | null
  >(null);
  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  const loadPlan = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await getToken();
      const { plan, weeklyMileageTargetPreference } = await fetchTrainingPlanDetail(
        planId,
        token
      );
      setPlan(plan as PlanDetail);
      setAthleteWeeklyTargetPreference(weeklyMileageTargetPreference);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      if (!opts?.quiet) {
        setPlan(null);
      }
    } finally {
      if (!opts?.quiet) {
        setLoading(false);
      }
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
    if (
      plan.weeklyMileageTarget != null &&
      Number.isFinite(Number(plan.weeklyMileageTarget))
    ) {
      setWeeklyMilesTarget(String(Math.round(Number(plan.weeklyMileageTarget))));
    } else if (
      athleteWeeklyTargetPreference != null &&
      Number.isFinite(athleteWeeklyTargetPreference)
    ) {
      setWeeklyMilesTarget(String(Math.round(athleteWeeklyTargetPreference)));
    } else {
      setWeeklyMilesTarget("");
    }
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
    plan?.weeklyMileageTarget,
    athleteWeeklyTargetPreference,
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

  /** Setup form: first-time generate, or user opened "Edit preferences". */
  const inPreferencesSetupMode = !hasSchedule || showPreferencesEditor;
  /** Preview calendar: only after schedule exists, not while editing or regenerating. */
  const showSchedulePreview =
    hasSchedule && !generating && !showPreferencesEditor;

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

  function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    return sa.every((v, i) => v === sb[i]);
  }

  const mileageOnlyEdit = useMemo(() => {
    if (!hasSchedule || !plan) return false;
    const savedDays = (plan.preferredDays ?? []).filter((n) => n >= 1 && n <= 7);
    const savedTarget =
      plan.weeklyMileageTarget != null && Number.isFinite(Number(plan.weeklyMileageTarget))
        ? Math.round(Number(plan.weeklyMileageTarget))
        : null;
    const inputTarget = Math.round(Number(weeklyMilesTarget.trim()));
    const targetChanged =
      Number.isFinite(inputTarget) &&
      (savedTarget == null || inputTarget !== savedTarget);
    const daysUnchanged = arraysEqual(preferredDaysLocal, savedDays);
    const longRunUnchanged =
      preferredLongRunDowLocal === (plan.preferredLongRunDow === 7 ? 7 : 6);
    const tempoUnchanged = preferredTempoDowLocal === (plan.preferredTempoDow ?? null);
    const intervalUnchanged =
      preferredIntervalDowLocal === (plan.preferredIntervalDow ?? null);
    return (
      targetChanged &&
      daysUnchanged &&
      longRunUnchanged &&
      tempoUnchanged &&
      intervalUnchanged
    );
  }, [
    hasSchedule,
    plan,
    weeklyMilesTarget,
    preferredDaysLocal,
    preferredLongRunDowLocal,
    preferredTempoDowLocal,
    preferredIntervalDowLocal,
  ]);

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
    if (!authReady || !plan || !showSchedulePreview) return;
    void fetchWeekWorkouts(weekNumber);
  }, [
    authReady,
    plan,
    showSchedulePreview,
    weekNumber,
    planScheduleEpoch,
    fetchWeekWorkouts,
  ]);

  function beginRegeneration() {
    setGenerating(true);
    setError(null);
    setRegenerationSuccess(false);
    setWeekDays([]);
    setSelectedDayKey("");
    setWeekNumber(1);
    setLoadingWeek(false);
  }

  async function finishGenerationSuccess() {
    setShowPreferencesEditor(false);
    setRegenerationSuccess(true);
    setPlanScheduleEpoch((epoch) => epoch + 1);
    await loadPlan({ quiet: true });
  }

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

  function resolveTargetMiles(): number | null {
    const weeklyMilesRaw = weeklyMilesTarget.trim();
    let targetMiles = weeklyMilesRaw === "" ? NaN : Math.round(Number(weeklyMilesRaw));
    if (!Number.isFinite(targetMiles)) {
      return null;
    }
    return Math.max(25, Math.min(100, targetMiles));
  }

  async function savePlanPreferences(token: string, targetMiles: number) {
    const normalized = preferredDaysLocal.filter((d) => d >= 1 && d <= 7);
    if (normalized.length === 0) {
      setError("Select at least one preferred training day.");
      return false;
    }

    const prefCheck = validatePreferredTempoInterval({
      preferredTempoDow: preferredTempoDowLocal,
      preferredIntervalDow: preferredIntervalDowLocal,
      preferredLongRunDow: preferredLongRunDowLocal,
      preferredDays: normalized,
    });
    if (!prefCheck.ok) {
      setError(prefCheck.error);
      return false;
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
      return false;
    }
    return true;
  }

  async function generatePlanSchedule(token: string, targetMiles: number) {
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
      return false;
    }
    return true;
  }

  async function savePreferredAndGenerate() {
    beginRegeneration();
    try {
      const token = await getToken();
      const targetMiles = resolveTargetMiles();
      if (targetMiles == null) {
        setError("Please enter a number for your weekly miles.");
        return;
      }
      const saved = await savePlanPreferences(token, targetMiles);
      if (!saved) return;
      const generated = await generatePlanSchedule(token, targetMiles);
      if (!generated) return;
      await finishGenerationSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateSchedule() {
    if (!plan) return;
    beginRegeneration();
    try {
      const token = await getToken();
      const targetMiles = resolveTargetMiles();
      if (targetMiles == null) {
        setError("Please enter a number for your weekly miles.");
        return;
      }
      const saved = await savePlanPreferences(token, targetMiles);
      if (!saved) return;
      const generated = await generatePlanSchedule(token, targetMiles);
      if (!generated) return;
      await finishGenerationSuccess();
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

          {regenerationSuccess && showSchedulePreview && (
            <div
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              role="status"
            >
              Schedule regenerated from your latest preferences. Review week 1 below, then
              open workouts or go to your plan.
            </div>
          )}

          {generating && hasSchedule && (
            <div
              className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-6 text-center text-sm text-gray-800"
              role="status"
            >
              <p className="font-medium text-gray-900">Regenerating your schedule…</p>
              <p className="mt-2 text-gray-600">
                Building a fresh plan from your preferences. Your previous week preview is
                hidden until the new schedule is ready.
              </p>
            </div>
          )}

          {showSchedulePreview && (
            <>
              <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">Here&apos;s your plan preview</p>
                <p className="mt-2 text-gray-600">
                  Step through weeks below and open each workout. Your saved preferences are
                  summarized here—edit them only when you want to regenerate.
                </p>
                <dl className="mt-4 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-gray-500">Weekly target</dt>
                    <dd>
                      {plan.weeklyMileageTarget != null &&
                      Number.isFinite(Number(plan.weeklyMileageTarget))
                        ? `${Math.round(Number(plan.weeklyMileageTarget))} mi/week`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Training days</dt>
                    <dd>{dayLabelsFromValues(plan.preferredDays ?? []) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Long run</dt>
                    <dd>{longRunDayLabel(plan.preferredLongRunDow)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Tempo / interval</dt>
                    <dd>
                      {plan.preferredTempoDow != null
                        ? DAY_OPTIONS.find((d) => d.value === plan.preferredTempoDow)?.label ??
                          "Preset default"
                        : "Preset default"}
                      {" · "}
                      {plan.preferredIntervalDow != null
                        ? DAY_OPTIONS.find((d) => d.value === plan.preferredIntervalDow)?.label ??
                          "Preset default"
                        : "Preset default"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setRegenerationSuccess(false);
                    setShowPreferencesEditor(true);
                  }}
                  className="mt-4 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Edit preferences & regenerate
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
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

              {!loadingWeek && weekDays.length === 0 && (
                <p className="mb-4 text-sm text-gray-500">
                  Loading workouts for this week… If nothing appears, set your 5K pace on
                  your profile so we can build segments.
                </p>
              )}
            </>
          )}

          {inPreferencesSetupMode && !generating && (
          <div className="mb-6 space-y-6">
            <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
              <p className="font-medium text-gray-900">
                {hasSchedule ? "Edit training preferences" : "Choose your training preferences"}
              </p>
              <p className="mt-2 leading-relaxed text-gray-700">
                {hasSchedule
                  ? "Adjust your weekly target and training days, then regenerate. Your current schedule preview is hidden while you edit."
                  : "Tell us roughly how many miles you want in a typical week and which days you like to run. We use that to size the plan before we generate your schedule. Each week won't match that number exactly—long-run weeks, taper, and recovery will move weekly volume up and down."}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Target is the weekly volume the plan aims toward. Planned miles are the
                generated workouts for a specific week.
              </p>
              {hasSchedule &&
              plan.weeklyMileageTarget != null &&
              Number.isFinite(Number(plan.weeklyMileageTarget)) ? (
                <p className="mt-2 text-xs font-medium text-orange-900/90">
                  Saved weekly target: {Math.round(Number(plan.weeklyMileageTarget))} mi/week
                </p>
              ) : null}
              {hasSchedule && showPreferencesEditor && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPreferencesEditor(false);
                    setError(null);
                  }}
                  className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
                >
                  Cancel — back to plan preview
                </button>
              )}
            </div>

            {!hasSchedule && presetGenerateWarnings.length > 0 && (
              <div
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                role="status"
              >
                <p className="mb-2 font-medium text-amber-950">Before you continue</p>
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
                Your ballpark for how much you want to run in a normal week—we aim the
                plan at it.
              </p>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                min={25}
                max={100}
                className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                value={weeklyMilesTarget}
                onChange={(e) => setWeeklyMilesTarget(e.target.value)}
              />
              {buildWarnings.belowEngineFloor && (
                <p
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
                  role="status"
                >
                  You entered {Math.round(Number(weeklyMilesTarget))} mi/week. This
                  plan&apos;s blueprint enforces at least {presetMinWeeklyMiles} mi/week when
                  we build the schedule, so the generator may use that minimum (or higher)
                  for weekly totals—especially on weeks with tempo, intervals, and long
                  runs.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-800">Preferred training days</p>
              <p className="mb-3 text-xs text-gray-500">
                Choose the days you want to train. We assign sessions on these days
                (Mon–Sun).
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
                  Fewer than four days makes it harder to spread easy mileage, interval/tempo
                  days, and recovery. Adding another day or two usually feels better on the
                  legs.
                </p>
              )}
              {buildWarnings.fourDays && (
                <p
                  className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950"
                  role="status"
                >
                  With four sessions a week, your off days are real recovery days—we aim to
                  make each workout day count (tempo, intervals, long, or easy). Listen to
                  easy days if we prescribe them.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-800">Long run day</p>
              <p className="mb-3 text-xs text-gray-500">
                Pick Saturday or Sunday for your long run. Interval and tempo days avoid this
                day.
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
                Pick a day for your tempo workout (from your preferred days, not your long
                run). If you skip this, we use the preset default (often Tuesday).
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
                Pick a day for intervals (from your preferred days, not your long run). If you
                skip this, we use the preset default (often Thursday). When both tempo and
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
              onClick={() =>
                void (hasSchedule ? regenerateSchedule() : savePreferredAndGenerate())
              }
              disabled={generating}
              className="w-full rounded-lg bg-orange-500 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {generating
                ? hasSchedule
                  ? mileageOnlyEdit
                    ? "Saving mileage target & regenerating…"
                    : "Saving & regenerating schedule…"
                  : "Saving preferences & generating schedule…"
                : hasSchedule
                  ? mileageOnlyEdit
                    ? "Save mileage target & regenerate"
                    : "Save & regenerate schedule"
                  : "Save preferences & generate schedule"}
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          )}

          {generating && !hasSchedule && (
            <div
              className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-6 text-center text-sm text-gray-800"
              role="status"
            >
              <p className="font-medium text-gray-900">Generating your schedule…</p>
              <p className="mt-2 text-gray-600">This usually takes a few seconds.</p>
            </div>
          )}

          {error && !inPreferencesSetupMode && (
            <p className="mb-4 text-sm text-red-600">{error}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/training-setup" className="hover:text-orange-600">
              New plan
            </Link>
            <Link href="/training" className="hover:text-orange-600">
              Training Hub
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
