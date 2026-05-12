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
import { validatePreferredTempoInterval } from "@/lib/training/preferred-tempo-interval";
import { isStructuredPlanWeek, type PlanDaySchedule } from "@/lib/training/plan-schedule-schema";

type PlanPresetSummary = {
  id: string;
  slug: string | null;
  title: string;
  intervalsConfig: { positions: unknown[] } | null;
  tempoConfig: { positions: unknown[] } | null;
  volumeConstraints?: {
    baseMiles?: number | null;
    minWeeklyMiles?: number | null;
    maxWeeklyMiles?: number | null;
  } | null;
} | null;

type CyclePoolData = {
  nCycles: number;
  cycleLen: number;
  poolMilesByCycle: number[];
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  positionCounts: { longRun: number; intervals: number; tempo: number };
} | null;

type LongRunRow = { weekNumber: number; miles: number; catalogueWorkoutId: string | null };
type QualityRow = {
  weekNumber: number;
  dow: number;
  miles: number;
  catalogueWorkoutId: string | null;
};

type ScheduleSummary = {
  cyclePoolData: CyclePoolData;
  longRunByWeek: LongRunRow[];
  intervalsByWeek: QualityRow[];
  temposByWeek: QualityRow[];
};

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

/** Matches generator default floor; not user-editable. */
const ENGINE_MIN_WEEKLY_MI = 40;

const MI_TARGET_FALLBACK = "50";

/** When the plan has no saved target yet, seed from preset base miles (clamped), not preset max. */
function defaultWeeklyTargetFromPreset(preset: NonNullable<PlanPresetSummary>): string {
  const vc = preset.volumeConstraints;
  if (!vc || typeof vc !== "object") return MI_TARGET_FALLBACK;
  const baseRaw = vc.baseMiles;
  const base =
    baseRaw != null && Number.isFinite(Number(baseRaw))
      ? Math.round(Number(baseRaw))
      : null;
  const minRaw = vc.minWeeklyMiles;
  const vmin =
    minRaw != null && Number.isFinite(Number(minRaw))
      ? Math.round(Number(minRaw))
      : ENGINE_MIN_WEEKLY_MI;
  const maxRaw = vc.maxWeeklyMiles;
  const vmax =
    maxRaw != null && Number.isFinite(Number(maxRaw)) ? Math.round(Number(maxRaw)) : null;
  let n = base ?? 50;
  n = Math.max(vmin, n);
  if (vmax != null) n = Math.min(vmax, n);
  n = Math.max(25, Math.min(100, n));
  return String(n);
}

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
  const [weeklyMilesTarget, setWeeklyMilesTarget] = useState(MI_TARGET_FALLBACK);
  const [preferredLongRunDowLocal, setPreferredLongRunDowLocal] = useState(6);
  const [preferredTempoDowLocal, setPreferredTempoDowLocal] = useState<number | null>(null);
  const [preferredIntervalDowLocal, setPreferredIntervalDowLocal] = useState<number | null>(
    null
  );
  const [generationStep, setGenerationStep] = useState<"preferences" | "preview">("preferences");
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null);
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
    } else if (plan.training_plan_preset) {
      setWeeklyMilesTarget(defaultWeeklyTargetFromPreset(plan.training_plan_preset));
    } else {
      setWeeklyMilesTarget(MI_TARGET_FALLBACK);
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
    plan?.training_plan_preset,
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
      let targetMiles = Math.round(Number(weeklyMilesTarget));
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
          minWeeklyMiles: ENGINE_MIN_WEEKLY_MI,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error || "Generation failed");
        return;
      }
      await loadPlan();
      // Fetch the schedule summary and show the preview step
      try {
        const summaryRes = await fetch(
          `/api/training/plan/schedule-summary?planId=${encodeURIComponent(planId)}`,
          { headers: athleteBearerFetchHeaders(token) }
        );
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setScheduleSummary(summaryData as ScheduleSummary);
        }
      } catch {
        // summary is non-critical — skip on error
      }
      setGenerationStep("preview");
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

          {hasSchedule && generationStep === "preview" && (
            <div className="mb-6 space-y-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">Plan generated!</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Review the long run engine output below, then head to your plan.
                </p>
              </div>

              {scheduleSummary?.cyclePoolData && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    Long-run pool by cycle
                  </p>
                  <p className="mb-3 text-xs text-gray-500">
                    Base {scheduleSummary.cyclePoolData.baseMiles} mi → Peak{" "}
                    {scheduleSummary.cyclePoolData.peakMiles} mi → Taper{" "}
                    {scheduleSummary.cyclePoolData.taperMiles} mi ·{" "}
                    {scheduleSummary.cyclePoolData.cycleLen}-week cycles ·{" "}
                    {scheduleSummary.cyclePoolData.nCycles} cycles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scheduleSummary.cyclePoolData.poolMilesByCycle.map((mi, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center"
                      >
                        <span className="text-xs text-gray-500">C{i + 1}</span>
                        <span className="text-sm font-semibold text-gray-900">{mi} mi</span>
                      </div>
                    ))}
                  </div>
                  {scheduleSummary.cyclePoolData.positionCounts.longRun === 0 && (
                    <p className="mt-3 text-xs font-medium text-red-600">
                      ⚠ Long run config has 0 positions — catalogue workouts not linked
                    </p>
                  )}
                </div>
              )}

              {scheduleSummary && scheduleSummary.longRunByWeek.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-900">Long run by week</p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500">
                          <th className="pb-1 text-left">Week</th>
                          <th className="pb-1 text-right">Miles</th>
                          <th className="pb-1 text-right pr-1">Catalogue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleSummary.longRunByWeek.map((row) => (
                          <tr
                            key={row.weekNumber}
                            className={`border-b border-gray-50 ${row.miles < 8 ? "bg-amber-50" : ""}`}
                          >
                            <td className="py-1 text-gray-700">Wk {row.weekNumber}</td>
                            <td className={`py-1 text-right font-medium ${row.miles < 8 ? "text-amber-700" : "text-gray-900"}`}>
                              {row.miles}
                            </td>
                            <td className="py-1 text-right pr-1">
                              {row.catalogueWorkoutId ? (
                                <span className="truncate text-xs text-gray-400 font-mono">
                                  {row.catalogueWorkoutId.slice(0, 8)}…
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-red-500">⚠ none</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scheduleSummary && scheduleSummary.intervalsByWeek.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-900">Intervals by week</p>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500">
                          <th className="pb-1 text-left">Week</th>
                          <th className="pb-1 text-right">Miles</th>
                          <th className="pb-1 text-right pr-1">Catalogue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleSummary.intervalsByWeek.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 text-gray-700">Wk {row.weekNumber}</td>
                            <td className="py-1 text-right font-medium text-gray-900">{row.miles}</td>
                            <td className="py-1 text-right pr-1">
                              {row.catalogueWorkoutId ? (
                                <span className="truncate text-xs text-gray-400 font-mono">
                                  {row.catalogueWorkoutId.slice(0, 8)}…
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-red-500">⚠ none</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {scheduleSummary.cyclePoolData?.positionCounts.intervals === 0 && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      ⚠ Intervals config has 0 positions
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => router.push(`/training`)}
                  className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Looks good — go to plan →
                </button>
                <button
                  onClick={() => {
                    setGenerationStep("preferences");
                    setScheduleSummary(null);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {hasSchedule && generationStep !== "preview" && (
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
