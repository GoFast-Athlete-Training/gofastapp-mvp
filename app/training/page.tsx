"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, MessageCircle, MoreHorizontal, Users } from "lucide-react";
import api from "@/lib/api";
import type { ScheduledRunJson } from "@/app/api/training/schedule-run/route";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import PlanWeekCalendar from "@/components/training/PlanWeekCalendar";
import WorkoutActivityMatchPanel from "@/components/training/WorkoutActivityMatchPanel";
import { buildWeekSummary } from "@/lib/training/week-summary-service";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  formatCalendarWeekRangeLabel,
  formatPlanDateDisplay,
  localTodayKey,
} from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  type PlanDayCard,
} from "@/lib/training/fetch-plan-week-client";
import { getRacePhase } from "@/lib/race-calendar-phase";

type PlanDetailHub = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  planSchedule: unknown;
  currentFiveKPace?: string | null;
  _count?: { planned_workouts: number };
  raceId?: string | null;
  race_registry: { name: string; raceDate?: string } | null;
};

function hasSchedule(p: PlanDetailHub): boolean {
  return Array.isArray(p.planSchedule) && (p.planSchedule as unknown[]).length > 0;
}

function effectiveWeeksForPlanHub(p: PlanDetailHub): number {
  return effectiveTrainingWeekCount(
    new Date(p.startDate),
    p.totalWeeks,
    p.race_registry?.raceDate ? new Date(p.race_registry.raceDate) : null
  );
}

function planDayMilesDisplay(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return "—";
  const mi = meters / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  return `${mi.toFixed(1)} mi`;
}

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function formatDurationSeconds(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) return `${h}h ${rm}m`;
  return `${m} min`;
}

export default function TrainingHubPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [planDetail, setPlanDetail] = useState<PlanDetailHub | null>(null);
  const [athleteFiveKPace, setAthleteFiveKPace] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>("");
  const [pushingGarmin, setPushingGarmin] = useState(false);
  const [garminPushMessage, setGarminPushMessage] = useState<string | null>(null);
  /** Active plan in DB is past race day — prompt next goal instead of full schedule UI. */
  const [pastRacePlan, setPastRacePlan] = useState<{
    id: string;
    name: string;
    raceName: string | null;
    raceId: string | null;
    raceDate: string | null;
  } | null>(null);
  /** Whether the athlete has logged a result + reflection for the finished race. */
  const [pastRaceResultStatus, setPastRaceResultStatus] = useState<{
    hasResult: boolean;
    hasReflection: boolean;
    resultId: string | null;
  } | null>(null);
  const [scheduledRuns, setScheduledRuns] = useState<ScheduledRunJson[]>([]);

  const pastRacePhase = useMemo(
    () => (pastRacePlan?.raceDate ? getRacePhase(pastRacePlan.raceDate) : null),
    [pastRacePlan?.raceDate]
  );

  const paceDisplay = useMemo(() => {
    if (!planDetail) return null;
    const p = planDetail.currentFiveKPace?.trim() || athleteFiveKPace?.trim();
    return p || null;
  }, [planDetail, athleteFiveKPace]);

  const effectiveTotalWeeks = useMemo(
    () => (planDetail ? effectiveWeeksForPlanHub(planDetail) : 1),
    [planDetail]
  );

  const calendarRangeLabel = useMemo(() => {
    if (!planDetail) return "";
    return formatCalendarWeekRangeLabel(planDetail.startDate, weekNumber, {
      raceDate: planDetail.race_registry?.raceDate ?? null,
      totalWeeks: effectiveTotalWeeks,
    });
  }, [planDetail, weekNumber, effectiveTotalWeeks]);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setHubError(null);
    setPlanDetail(null);
    setPastRacePlan(null);
    setPastRaceResultStatus(null);
    setWeekDays([]);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const listRes = await fetch("/api/training-plan?status=active", {
        headers: athleteBearerFetchHeaders(token),
      });
      const listData = await listRes.json();
      if (!listRes.ok || !Array.isArray(listData.plans) || listData.plans.length === 0) {
        return;
      }
      const planId = (listData.plans[0] as { id: string }).id;
      const { plan: raw, athleteFiveKPace: athPace } = await fetchTrainingPlanDetail(
        planId,
        token
      );
      const plan = raw as PlanDetailHub;
      setAthleteFiveKPace(athPace);

      const planPhase = getRacePhase(plan.race_registry?.raceDate);
      if (planPhase !== "pre") {
        setPlanDetail(null);
        setPastRacePlan({
          id: plan.id,
          name: plan.name,
          raceName: plan.race_registry?.name ?? null,
          raceId: plan.raceId ?? null,
          raceDate:
            typeof plan.race_registry?.raceDate === "string"
              ? plan.race_registry.raceDate
              : plan.race_registry?.raceDate != null
                ? String(plan.race_registry.raceDate)
                : null,
        });
        setWeekDays([]);
        // Probe whether the athlete already logged a result + reflection
        if (plan.raceId) {
          fetch(`/api/race-results?raceRegistryId=${encodeURIComponent(plan.raceId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json() as Promise<{ results?: Array<{ id: string; officialFinishTime?: string | null; reflection?: string | null }> }>)
            .then(({ results }) => {
              const first = results?.[0] ?? null;
              setPastRaceResultStatus({
                hasResult: Boolean(first?.officialFinishTime),
                hasReflection: Boolean(first?.reflection),
                resultId: first ? first.id : null,
              });
            })
            .catch(() => {/* non-critical */});
        }
        return;
      }

      setPlanDetail(plan);
      if (hasSchedule(plan)) {
        const wn = currentTrainingWeekNumber(
          plan.startDate,
          effectiveWeeksForPlanHub(plan)
        );
        setWeekNumber(wn);
        setSelectedDayKey(localTodayKey());
      }
    } catch (e) {
      setHubError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
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
    void loadHub();
  }, [authReady, loadHub]);

  const fetchWeekDays = useCallback(
    async (wn: number) => {
      if (!planDetail || !hasSchedule(planDetail)) return;
      setLoadingWeek(true);
      try {
        const u = auth.currentUser;
        if (!u) return;
        const token = await u.getIdToken();
        const { days } = await fetchPlanWeekSchedule(planDetail.id, wn, token);
        setWeekDays(days);
        const today = localTodayKey();
        setSelectedDayKey((prev) => {
          if (days.some((d) => d.dateKey === prev)) return prev;
          if (days.some((d) => d.dateKey === today)) return today;
          return days[0]?.dateKey ?? today;
        });
      } catch (e) {
        setHubError(e instanceof Error ? e.message : "Could not load this week");
        setWeekDays([]);
      } finally {
        setLoadingWeek(false);
      }
    },
    [planDetail]
  );

  useEffect(() => {
    if (!authReady || !planDetail || !hasSchedule(planDetail)) return;
    void fetchWeekDays(weekNumber);
  }, [authReady, planDetail?.id, weekNumber, fetchWeekDays]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ scheduledRuns: ScheduledRunJson[] }>(
          "/training/schedule-run?days=7"
        );
        if (!cancelled) setScheduledRuns(data?.scheduledRuns ?? []);
      } catch {
        if (!cancelled) setScheduledRuns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  async function handleSendTodayToGarmin() {
    const u = auth.currentUser;
    if (!u) return;
    setPushingGarmin(true);
    setGarminPushMessage(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/me/push-todays-plan-workout", {
        method: "POST",
        headers: athleteBearerFetchHeaders(token),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        scheduledDate?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not push to Garmin");
      }
      setGarminPushMessage(
        data.scheduledDate
          ? `Sent to Garmin for ${data.scheduledDate}. Sync your watch in Garmin Connect.`
          : "Sent to Garmin. Sync your watch in Garmin Connect."
      );
      if (planDetail) {
        void fetchWeekDays(weekNumber);
      }
    } catch (e) {
      setGarminPushMessage(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushingGarmin(false);
    }
  }

  function handleOpenSession(dateKey: string) {
    router.push(`/training/day/${dateKey}`);
  }

  async function deleteActivePlan() {
    if (!planDetail) return;
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
      const res = await fetch(`/api/training-plan/${planDetail.id}`, {
        method: "DELETE",
        headers: athleteBearerFetchHeaders(token),
      });
      if (res.ok) {
        await loadHub();
      }
    } finally {
      setDeleting(false);
    }
  }

  const showDashboard = !!planDetail && hasSchedule(planDetail);
  const showIncompletePlan = !!planDetail && !hasSchedule(planDetail);

  const todayKey = localTodayKey();
  const focusKey = selectedDayKey || todayKey;
  const focusPlanDay = weekDays.find((d) => d.dateKey === focusKey) ?? null;
  const focusIsToday = focusKey === todayKey;

  const weekPlannedMiles = useMemo(() => {
    if (!weekDays.length) return null;
    const m = weekDays.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0);
    if (!Number.isFinite(m) || m <= 0) return null;
    return Math.round((m / 1609.34) * 10) / 10;
  }, [weekDays]);

  const weekSummary = useMemo(() => {
    if (!weekDays.length) return null;
    return buildWeekSummary({
      weekNumber,
      totalWeeks: effectiveTotalWeeks,
      days: weekDays,
    });
  }, [weekDays, weekNumber, effectiveTotalWeeks]);

  function goPrevWeek() {
    setWeekNumber((n) => Math.max(1, n - 1));
  }

  function goNextWeek() {
    setWeekNumber((n) => Math.min(effectiveTotalWeeks, n + 1));
  }

  return (
    <AthleteAppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Train</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Your schedule this week. Logged runs and analysis live in{" "}
                <Link href="/performance" className="font-semibold text-orange-600 hover:text-orange-700">
                  Performance
                </Link>
                .
              </p>
            </div>
            <Link
              href="/training/past-plans"
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm hover:border-gray-300 hover:text-gray-900"
            >
              Past plans
            </Link>
          </div>
        </div>

        {loading && (
          <p className="mb-6 text-sm text-gray-500">Loading your training…</p>
        )}

        {hubError && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {hubError}
          </p>
        )}

        {authReady && !loading && !planDetail && !pastRacePlan && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No active plan yet</h2>
            <p className="text-sm text-gray-600 mb-6">
              Start a plan from your race goal, or log a workout without a full schedule.
            </p>
            <Link
              href="/training-setup"
              className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Start or connect a plan
            </Link>
          </div>
        )}

        {authReady && !loading && pastRacePlan && pastRacePhase === "race_day" && (
          <div className="rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-8 shadow-sm mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 mb-1">
              Today is race day
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Good luck!</h2>
            {pastRacePlan.raceName && (
              <p className="text-base text-gray-700 mb-4">{pastRacePlan.raceName}</p>
            )}
            <p className="text-sm text-gray-600 mb-5">
              You&apos;ve put in the miles. Race hub has your crew — no need to log a result yet.
            </p>
            {pastRacePlan.raceId ? (
              <Link
                href={`/race-hub/${pastRacePlan.raceId}`}
                className="inline-flex justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Open race hub
              </Link>
            ) : null}
          </div>
        )}

        {authReady && !loading && pastRacePlan && pastRacePhase === "post_early" && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-8 shadow-sm mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
              Race complete
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">You did it.</h2>
            {pastRacePlan.raceName && (
              <p className="text-base text-gray-700 mb-4">{pastRacePlan.raceName}</p>
            )}
            <p className="text-sm text-gray-600 mb-5">
              How did it go? Log your finish time and reflection while it&apos;s fresh.
            </p>

            {pastRaceResultStatus && (!pastRaceResultStatus.hasResult || !pastRaceResultStatus.hasReflection) && pastRacePlan.raceId && (
              <div className="mb-5 space-y-2">
                {!pastRaceResultStatus.hasResult && (
                  <Link
                    href={`/race-hub/${pastRacePlan.raceId}#log-result`}
                    className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Log your finish time
                  </Link>
                )}
                {pastRaceResultStatus.hasResult && !pastRaceResultStatus.hasReflection && (
                  <Link
                    href={`/race-hub/${pastRacePlan.raceId}#log-result`}
                    className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
                  >
                    Add a race reflection
                  </Link>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href="/races"
                className="inline-flex justify-center rounded-xl border-2 border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Find your next race
              </Link>
              <Link
                href={`/training-setup/${pastRacePlan.id}`}
                className="inline-flex justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Analyze your plan
              </Link>
            </div>
          </div>
        )}

        {authReady && !loading && pastRacePlan && pastRacePhase === "post_cooled" && (
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Race complete
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Your training history is saved</h2>
            {pastRacePlan.raceName && (
              <p className="text-base text-gray-600 mb-4">{pastRacePlan.raceName}</p>
            )}
            <p className="text-sm text-gray-600 mb-5">
              Ready to find the next one?
            </p>

            <div className="flex flex-wrap gap-3 items-center mb-5">
              <Link
                href="/races"
                className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Find your next race
              </Link>
              <Link
                href={`/training-setup/${pastRacePlan.id}`}
                className="inline-flex justify-center rounded-lg text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
              >
                Analyze your plan
              </Link>
            </div>

            {pastRaceResultStatus && (!pastRaceResultStatus.hasResult || !pastRaceResultStatus.hasReflection) && pastRacePlan.raceId && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Still need to capture your race?</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {!pastRaceResultStatus.hasResult && (
                    <Link
                      href={`/race-hub/${pastRacePlan.raceId}#log-result`}
                      className="font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Log result
                    </Link>
                  )}
                  {pastRaceResultStatus.hasResult && !pastRaceResultStatus.hasReflection && (
                    <Link
                      href={`/race-hub/${pastRacePlan.raceId}#log-result`}
                      className="font-medium text-blue-700 hover:text-blue-800"
                    >
                      Add reflection
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showIncompletePlan && planDetail && (
          <div className="mb-8 rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Finish your plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">{planDetail.name}</h2>
            {planDetail.race_registry?.name && (
              <p className="mt-1 text-sm text-gray-600">{planDetail.race_registry.name}</p>
            )}
            <p className="mt-3 text-sm text-amber-950/90">
              Generate your schedule in setup to see workouts here each week.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/training-setup/${planDetail.id}`}
                className="inline-flex justify-center rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Continue plan setup
              </Link>
            </div>
          </div>
        )}

        {showDashboard && planDetail && (
          <div className="space-y-4 mb-8">
            {/* Plan header — week context + miles all in one place */}
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{planDetail.name}</p>
                <p className="text-gray-600 tabular-nums">
                  Week {weekNumber} of {effectiveTotalWeeks}
                  {weekPlannedMiles != null ? ` · ${weekPlannedMiles} mi` : ""}
                  {calendarRangeLabel ? ` · ${calendarRangeLabel}` : ""}
                </p>
                {planDetail.race_registry?.name ? (
                  <p className="text-xs text-gray-500 mt-0.5">{planDetail.race_registry.name}</p>
                ) : null}
                {paceDisplay ? (
                  <p className="mt-1 text-xs text-emerald-900/80">
                    5K pace:{" "}
                    <span className="font-mono tabular-nums">{paceDisplay}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={planMenuOpen}
                    aria-haspopup="true"
                    onClick={() => setPlanMenuOpen((o) => !o)}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
                    title="Plan options"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                  {planMenuOpen ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close menu"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setPlanMenuOpen(false)}
                      />
                      <div className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <Link
                          href={`/training-setup/${planDetail.id}`}
                          className="block px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                          onClick={() => setPlanMenuOpen(false)}
                        >
                          Update plan
                        </Link>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => {
                            setPlanMenuOpen(false);
                            void deleteActivePlan();
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleting ? "Deleting…" : "Delete plan"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {scheduledRuns.length > 0 ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-sky-700" />
                  Upcoming scheduled runs
                </p>
                <ul className="mt-2 space-y-2">
                  {scheduledRuns.map((sr) => {
                    const dk = sr.date.slice(0, 10);
                    return (
                      <li
                        key={sr.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-gray-800"
                      >
                        <span>
                          <span className="font-medium">{sr.title}</span>
                          <span className="text-gray-500">
                            {" "}
                            ·{" "}
                            {formatPlanDateDisplay(dk, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            {sr.startTimeLabel ? ` · ${sr.startTimeLabel}` : ""}
                          </span>
                        </span>
                        {sr.joinPath ? (
                          <Link
                            href={sr.joinPath}
                            className="text-xs font-semibold text-sky-800 hover:text-sky-950"
                          >
                            Share link
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* Plan calendar — week strip, colored cards, selected day detail */}
            <div id="training-section-this-week" className="scroll-mt-24">
              <PlanWeekCalendar
                weekNumber={weekNumber}
                totalWeeks={effectiveTotalWeeks}
                days={weekDays}
                loading={loadingWeek}
                todayKey={todayKey}
                selectedDateKey={focusKey}
                calendarRangeLabel={calendarRangeLabel}
                summary={weekSummary}
                onPrevWeek={goPrevWeek}
                onNextWeek={goNextWeek}
                onSelectDay={(d) => setSelectedDayKey(d.dateKey)}
                collapseCardsOnMobile
                selectedDayDetail={
                  !loadingWeek ? (
                <div
                  id="training-section-today"
                  className={
                    focusPlanDay?.matchedActivityId
                      ? "rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm scroll-mt-24"
                      : "rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm scroll-mt-24"
                  }
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      focusPlanDay?.matchedActivityId ? "text-emerald-900" : "text-orange-900"
                    }`}
                  >
                    {focusIsToday ? "Today" : "Selected day"}
                  </p>
                  {focusPlanDay ? (
                    focusPlanDay.matchedActivityId ? (
                      <>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          Workout logged
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-gray-900">
                          Workout logged!
                        </h2>
                        <p className="mt-2 text-lg font-semibold text-gray-800">
                          {displayWorkoutListTitle(focusPlanDay)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatPlanDateDisplay(focusPlanDay.dateKey || String(focusPlanDay.date), {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            Logged
                          </span>
                        </p>
                        <div className="mt-4 space-y-1 rounded-xl border border-emerald-100 bg-white/70 px-4 py-3 text-sm text-gray-800">
                          <p className="tabular-nums">
                            <span className="text-gray-500">Scheduled: </span>
                            {planDayMilesDisplay(focusPlanDay.estimatedDistanceInMeters)}
                          </p>
                          {focusPlanDay.actualDistanceMeters != null &&
                          focusPlanDay.actualDistanceMeters > 0 ? (
                            <p className="tabular-nums font-medium text-gray-900">
                              Ran: {metersToMiDisplay(focusPlanDay.actualDistanceMeters)}
                            </p>
                          ) : null}
                          {focusPlanDay.actualAvgPaceSecPerMile != null ? (
                            <p className="tabular-nums">
                              <span className="text-gray-500">Pace: </span>
                              {formatSecPerMile(focusPlanDay.actualAvgPaceSecPerMile)}
                            </p>
                          ) : null}
                          {formatDurationSeconds(focusPlanDay.actualDurationSeconds) ? (
                            <p className="tabular-nums">
                              <span className="text-gray-500">Time: </span>
                              {formatDurationSeconds(focusPlanDay.actualDurationSeconds)}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {focusPlanDay.workoutId ? (
                            <Link
                              href={`/workouts/${focusPlanDay.workoutId}`}
                              className="inline-flex justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                              Review run
                            </Link>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="mt-2 text-2xl font-bold text-gray-900">
                          {displayWorkoutListTitle(focusPlanDay)}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatPlanDateDisplay(focusPlanDay.dateKey || String(focusPlanDay.date), {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                          {focusPlanDay.estimatedDistanceInMeters
                            ? ` · ${planDayMilesDisplay(focusPlanDay.estimatedDistanceInMeters)}`
                            : ""}
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {focusPlanDay.workoutId && !focusPlanDay.matchedActivityId ? (
                            <button
                              type="button"
                              onClick={() => {
                                document
                                  .getElementById("match-garmin-panel")
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className="inline-flex justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700"
                            >
                              I did this workout
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleOpenSession(focusPlanDay.dateKey)}
                            disabled={pushingGarmin}
                            className="inline-flex justify-center rounded-xl border-2 border-orange-300 bg-white px-6 py-3 text-sm font-semibold text-orange-900 hover:bg-orange-50 disabled:opacity-50"
                          >
                            Open session
                          </button>
                          {focusIsToday ? (
                            <button
                              type="button"
                              disabled={pushingGarmin}
                              onClick={() => void handleSendTodayToGarmin()}
                              className="inline-flex justify-center rounded-xl border-2 border-sky-600 bg-sky-50 px-6 py-3 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                            >
                              {pushingGarmin ? "Sending…" : "Send to Garmin"}
                            </button>
                          ) : null}
                          <Link
                            href={
                              focusPlanDay.workoutId
                                ? `/training/schedule-run?date=${encodeURIComponent(focusPlanDay.dateKey)}&workoutId=${encodeURIComponent(focusPlanDay.workoutId)}`
                                : `/training/schedule-run?date=${encodeURIComponent(focusPlanDay.dateKey)}`
                            }
                            className="inline-flex justify-center rounded-xl border-2 border-sky-600 bg-white px-5 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-50"
                          >
                            Schedule this run
                          </Link>
                        </div>
                        {focusIsToday && garminPushMessage ? (
                          <p className="mt-3 text-sm text-gray-700" role="status">
                            {garminPushMessage}
                          </p>
                        ) : null}
                        {focusPlanDay.workoutId && !focusPlanDay.matchedActivityId ? (
                          <div className="mt-4">
                            <WorkoutActivityMatchPanel
                              workoutId={focusPlanDay.workoutId}
                              workoutTitle={displayWorkoutListTitle(focusPlanDay)}
                              compact
                              onMatched={loadHub}
                            />
                          </div>
                        ) : null}
                      </>
                    )
                  ) : (
                    <>
                      <p className="mt-2 text-lg font-semibold text-gray-900">
                        {focusIsToday
                          ? "No session on the schedule for today"
                          : "Rest or unscheduled on this day"}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Pick another day above, or log a standalone workout.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href="/performance"
                          className="inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                        >
                          Performance
                        </Link>
                        <Link
                          href="/workouts/create"
                          className="inline-flex justify-center rounded-xl border-2 border-orange-300 bg-white px-5 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-50"
                        >
                          Log a workout
                        </Link>
                      </div>
                    </>
                  )}
                </div>
                  ) : null
                }
              />
            </div>

            {/* Secondary actions — always visible, not buried */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm">
              <Link
                href="/training/schedule-run"
                className="font-medium text-sky-800 hover:text-sky-950"
              >
                Schedule a run
              </Link>
              <span className="text-gray-300" aria-hidden>·</span>
              <Link href="/gorun" className="font-medium text-gray-600 hover:text-gray-900">
                Find a run with others
              </Link>
              <span className="text-gray-300" aria-hidden>·</span>
              <Link href="/build-a-run" className="font-medium text-gray-600 hover:text-gray-900">
                Create a workout from scratch
              </Link>
              <span className="text-gray-300" aria-hidden>·</span>
              <Link href="/workouts" className="font-medium text-gray-600 hover:text-gray-900">
                Workout log
              </Link>
            </div>
          </div>
        )}

        {authReady && !loading && !showDashboard && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              More in training
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/ask-coach"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <MessageCircle className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">AI Coach</span>
                <span className="text-xs text-gray-600">Questions about your plan or pacing</span>
              </Link>
              <Link
                href="/journal"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <BookOpen className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">Training journal</span>
                <span className="text-xs text-gray-600">Notes and how training feels</span>
              </Link>
              <Link
                href="/my-runcrews"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:bg-orange-50/40 transition flex flex-col gap-2"
              >
                <Users className="h-6 w-6 text-orange-600 shrink-0" aria-hidden />
                <span className="font-semibold text-gray-900">Training pod</span>
                <span className="text-xs text-gray-600">Your crew and accountability</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </AthleteAppShell>
  );
}
