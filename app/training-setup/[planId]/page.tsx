"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutList } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import PhaseViewModal, { type PlanWeekRow } from "@/components/training/PhaseViewModal";
import {
  parsePhasesJson,
  phaseNameForWeek,
  type PhaseRange,
} from "@/lib/training/plan-phases";
import { cataloguePhaseFallbackForWeek } from "@/lib/training/plan-utils";
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
import { normalizePreferredQualityDays } from "@/lib/training/preferred-quality-days";
import { isStructuredPlanWeek, type PlanDaySchedule } from "@/lib/training/plan-schedule-schema";

type PlanPresetSummary = {
  id: string;
  slug: string | null;
  title: string;
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

/** Matches generator default floor; not user-editable. */
const ENGINE_MIN_WEEKLY_MI = 40;

const MI_PER_M = 1609.34;

function typeLabelForCard(workoutType: string): string {
  switch (workoutType) {
    case "Easy":
      return "Easy";
    case "Tempo":
      return "Tempo";
    case "Intervals":
      return "Intervals";
    case "LongRun":
      return "Long run";
    case "Race":
      return "Race";
    default:
      return "Run";
  }
}

/** Bold primary line: catalogue / custom title when present; else type label (no miles). */
function workoutCardPrimaryName(w: PlanDayCard): string {
  const raw = w.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;
  if (/\b—\s*Week\s*\d+/i.test(raw) || /\bWeek\s*\d+\s*$/i.test(raw)) {
    return typeLabelForCard(w.workoutType);
  }
  if (raw.length > 0) return raw;
  return typeLabelForCard(w.workoutType);
}

function weekTotalMilesDisplay(days: PlanDayCard[]): string {
  const m =
    days.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0) / MI_PER_M;
  if (!Number.isFinite(m) || m <= 0) return "—";
  const rounded = Math.round(m * 10) / 10;
  return `${rounded} mi`;
}

function formatWeekCardMiles(
  estimatedDistanceInMeters: number | null
): string {
  if (
    estimatedDistanceInMeters == null ||
    !Number.isFinite(estimatedDistanceInMeters)
  ) {
    return "";
  }
  const mi = estimatedDistanceInMeters / MI_PER_M;
  const rounded =
    Math.abs(mi - Math.round(mi)) < 0.06
      ? Math.round(mi)
      : Math.round(mi * 10) / 10;
  return `${rounded} mi`;
}

function workoutTypeLeftBorderClass(workoutType: string): string {
  switch (workoutType) {
    case "Easy":
      return "bg-green-400";
    case "LongRun":
      return "bg-purple-500";
    case "Tempo":
      return "bg-amber-400";
    case "Intervals":
      return "bg-orange-500";
    case "Race":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
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
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [preferredDaysLocal, setPreferredDaysLocal] = useState<number[]>([]);
  const [weeklyMilesTarget, setWeeklyMilesTarget] = useState("50");
  const [preferredLongRunDowLocal, setPreferredLongRunDowLocal] = useState(6);
  const [preferredQualityDaysLocal, setPreferredQualityDaysLocal] = useState<
    number[]
  >([]);
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
      plan.weeklyMileageTarget != null && Number.isFinite(Number(plan.weeklyMileageTarget))
        ? Math.round(Number(plan.weeklyMileageTarget))
        : null;
    if (fromPlan != null) {
      setWeeklyMilesTarget(String(fromPlan));
    } else {
      setWeeklyMilesTarget("50");
    }
    const pld = plan.preferredLongRunDow;
    if (pld === 6 || pld === 7) {
      setPreferredLongRunDowLocal(pld);
    } else {
      setPreferredLongRunDowLocal(6);
    }
    const pqd = plan.preferredQualityDays;
    if (Array.isArray(pqd) && pqd.length > 0) {
      setPreferredQualityDaysLocal(
        [...pqd].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b)
      );
    } else {
      setPreferredQualityDaysLocal([]);
    }
  }, [
    plan?.id,
    plan?.preferredDays,
    plan?.preferredLongRunDow,
    plan?.preferredQualityDays,
    plan?.weeklyMileageTarget,
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

  const presetGenerateWarnings = useMemo(() => {
    if (!plan || hasSchedule) return [] as string[];
    const msgs: string[] = [];
    const preset = plan.training_plan_preset;
    if (!plan.presetId) {
      msgs.push(
        "This plan was created before presets were enforced. We&apos;ll attach the system's default blueprint when you generate—if generation fails with a preset error, ask your coach to publish training presets."
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

  const showWeekPhaseBadge = useMemo(() => {
    const relevant = weekEntries.filter(
      (e) => e.weekNumber <= effectiveTotalWeeks
    );
    if (relevant.length < 2) return false;
    const labels = new Set(
      relevant.map((e) =>
        phaseNameForWeek(phaseRanges, e.weekNumber, e.phase?.trim() ?? "")
      )
    );
    return labels.size > 1;
  }, [weekEntries, effectiveTotalWeeks, phaseRanges]);

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
      setPreferredQualityDaysLocal((q) =>
        q.filter((x) => next.includes(x) && x !== preferredLongRunDowLocal)
      );
      return next;
    });
  }

  function toggleQualityDay(d: number) {
    if (!preferredDaysLocal.includes(d) || d === preferredLongRunDowLocal) {
      return;
    }
    setPreferredQualityDaysLocal((prev) => {
      const next = prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => a - b);
      const norm = normalizePreferredQualityDays(
        next,
        preferredDaysLocal,
        preferredLongRunDowLocal
      );
      if (!norm.ok) {
        setError(norm.error);
        return prev;
      }
      setError(null);
      return norm.value;
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

      const qNorm = normalizePreferredQualityDays(
        preferredQualityDaysLocal,
        normalized,
        preferredLongRunDowLocal
      );
      if (!qNorm.ok) {
        setError(qNorm.error);
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
          preferredQualityDays: qNorm.value,
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
    setWeekNumber((n) => Math.min(effectiveTotalWeeks, n + 1));
  }

  function openPlanDay(day: PlanDayCard) {
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
                          setPreferredQualityDaysLocal((q) =>
                            q.filter((d) => d !== value)
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">
                  Interval &amp; tempo days (optional)
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  Choose up to two days from your preferred days (not your long run
                  day). Typically first pick = tempo day, second = interval day — at
                  least two days apart. If you skip this, we use the preset defaults (often Tuesday and Thursday).
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map(({ value, label }) => {
                    const inPrefs = preferredDaysLocal.includes(value);
                    const isLr = value === preferredLongRunDowLocal;
                    const disabled = !inPrefs || isLr;
                    return (
                      <label
                        key={value}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm ${
                          disabled
                            ? "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                            : "cursor-pointer border-gray-200 bg-gray-50 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-40"
                          checked={preferredQualityDaysLocal.includes(value)}
                          disabled={disabled}
                          onChange={() => toggleQualityDay(value)}
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
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-lg font-semibold text-gray-900 sm:text-xl">
                        Week {weekNumber} of {effectiveTotalWeeks}
                      </p>
                      {weekDays.length > 0 && (
                        <p className="text-sm font-medium text-gray-600 tabular-nums">
                          {weekTotalMilesDisplay(weekDays)} total
                        </p>
                      )}
                    </div>
                    {showWeekPhaseBadge && weekPhaseLabel && (
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
                      disabled={weekNumber >= effectiveTotalWeeks}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {weekDays.length > 0 ? (
                  <ul className="mt-1 space-y-3">
                    {weekDays.map((w) => {
                      const mi = formatWeekCardMiles(
                        w.estimatedDistanceInMeters
                      );
                      const subtype = `${typeLabelForCard(w.workoutType)}${
                        mi ? ` · ${mi}` : ""
                      }`;
                      return (
                        <li key={w.dateKey}>
                          <button
                            type="button"
                            onClick={() => openPlanDay(w)}
                            className="block w-full overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
                          >
                            <div className="flex min-h-[4.25rem]">
                              <div
                                className={`w-1.5 shrink-0 ${workoutTypeLeftBorderClass(
                                  w.workoutType
                                )}`}
                              />
                              <div className="flex flex-1 flex-col px-4 py-3">
                                <p className="text-xs text-gray-500">
                                  {w.date
                                    ? formatPlanDateDisplay(w.date, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : "—"}
                                </p>
                                <p className="mt-0.5 text-base font-semibold leading-snug text-gray-900">
                                  {workoutCardPrimaryName(w)}
                                </p>
                                <p className="mt-0.5 text-sm text-gray-500">
                                  {subtype || "—"}
                                </p>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
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

      <PhaseViewModal
        open={phaseModalOpen}
        onClose={() => setPhaseModalOpen(false)}
        phases={phaseRanges}
        overviewWeeks={weekEntries}
        onJumpToWeek={(wn) => setWeekNumber(wn)}
      />

    </AthleteAppShell>
  );
}
