"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import {
  addDaysUtc,
  formatPlanDateDisplay,
  localYmd,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import {
  fetchTrainingPlanDetail,
  fetchTrainingWorkoutDetail,
  resolveWorkoutForPlanDay,
} from "@/lib/training/fetch-plan-week-client";
import {
  formatSegmentDuration,
  groupSegmentsForDisplay,
  formatGroupedSegmentDuration,
  formatBetweenRepeatsRecoveryLabel,
  humanDisplayGroupTitle,
  humanPlanStepSideTag,
  humanizeSegmentTitle,
  isMultiStepRepeatGroup,
  type SegmentDisplayGroup,
} from "@/lib/training/segment-summary";
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
  workoutTargetTypeLabel,
} from "@/lib/workout-generator/pace-calculator";
import {
  pickWorkoutPayload,
  type PreviewWorkout,
} from "@/lib/training/workout-preview-payload";
import { stashWorkoutDayNav, TRAINING_HUB_BACK_PATH } from "@/lib/training/workout-day-nav";
import { workoutDetailPathWithBackHref } from "@/lib/training/workout-nav-query";
import LogRaceResultSheet from "@/components/races/LogRaceResultSheet";
import WorkoutActivityMatchPanel from "@/components/training/WorkoutActivityMatchPanel";
import WorkoutSkipActions from "@/components/training/WorkoutSkipActions";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";
import { buildRunResultStatus } from "@/lib/training/run-result-status";
import {
  deriveSessionStatus,
} from "@/lib/training/session-status";

function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

function formatDurationSeconds(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

type PlanDetail = {
  id: string;
  name: string;
  totalWeeks: number;
  startDate: string;
  planSchedule: unknown;
  raceId?: string | null;
  race_registry?: {
    id: string;
    name: string;
    raceDate: string;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
  athlete_goal?: { id: string } | null;
};

function hasSchedule(p: PlanDetail): boolean {
  return Array.isArray(p.planSchedule) && (p.planSchedule as unknown[]).length > 0;
}

function normalizeDateKey(raw: string): string | null {
  const t = decodeURIComponent(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

function dateKeyToUtcOnly(dateKey: string): Date {
  return utcDateOnly(new Date(`${dateKey}T12:00:00Z`));
}

function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  try {
    const d = dateKeyToUtcOnly(dateKey);
    const next = addDaysUtc(d, deltaDays);
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    const day = String(next.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

function formatPreviewWorkoutTypeLabel(workoutType: string, isRace: boolean): string {
  if (isRace) return "Race";
  const map: Record<string, string> = {
    Easy: "Easy run",
    LongRun: "Long run",
    Intervals: "Intervals",
    Tempo: "Tempo",
    Race: "Race",
    SpeedDuration: "Speed",
  };
  if (map[workoutType]) return map[workoutType]!;
  return workoutType.replace(/([A-Z])/g, " $1").trim() || workoutType;
}

function previewSegmentTargetSummary(
  segment: PreviewWorkout["segments"][number]
): string | null {
  const targets = segment.targets;
  if (!targets?.length) return null;
  const parts: string[] = [];
  for (const t of targets) {
    const type = (t.type || "").toUpperCase();
    if (type === "PACE") {
      if (t.valueLow != null && t.valueHigh != null) {
        parts.push(formatPaceTargetRangeForDisplay(t.valueLow, t.valueHigh));
      } else if (typeof t.value === "number" && Number.isFinite(t.value)) {
        parts.push(formatPaceTargetSingleForDisplay(t.value));
      }
    } else if (
      (type === "HEART_RATE" || type === "HEARTRATE") &&
      t.valueLow != null &&
      t.valueHigh != null
    ) {
      parts.push(
        `${workoutTargetTypeLabel(t.type)} ${t.valueLow}–${t.valueHigh} bpm`
      );
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

function segmentHeaderClass(title: string, workoutType?: string): string {
  const t = humanizeSegmentTitle(title, workoutType).toLowerCase();
  if (t.includes("warm") || t.includes("cool")) return "bg-gray-500 text-white";
  if (t.includes("recovery")) return "bg-teal-600 text-white";
  if (t.includes("tempo") || t.includes("interval")) return "bg-orange-500 text-white";
  return "bg-gray-400 text-white";
}

function previewGroupedSegmentTargetSummary(
  group: SegmentDisplayGroup<PreviewWorkout["segments"][number]>
): string | null {
  return previewSegmentTargetSummary(group.work);
}

function previewGroupedRecoveryDistanceLine(
  group: SegmentDisplayGroup<PreviewWorkout["segments"][number]>
): string | null {
  const between = formatBetweenRepeatsRecoveryLabel(group);
  if (between) return between.replace(/^Between repeats: /, "");
  if (!group.recovery) return null;
  return formatSegmentDuration({
    stepOrder: group.recovery.stepOrder,
    durationType: group.recovery.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: group.recovery.durationValue,
    repeatCount: group.recovery.repeatCount ?? null,
    title: group.recovery.title,
  });
}

export default function TrainingPlanDayPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawDateKey = params.dateKey as string;
  const dateKey = normalizeDateKey(rawDateKey);

  const planIdFromQuery = searchParams.get("planId")?.trim() || null;
  const sourceSetup = searchParams.get("source") === "setup";
  const sourceHome = searchParams.get("source") === "home";

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  /** Find-or-create by date failed (e.g. no scheduled day) */
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  /** Workout exists but full detail/segments failed — user can still open workout */
  const [workoutDetailError, setWorkoutDetailError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PreviewWorkout | null>(null);
  const [openingWorkout, setOpeningWorkout] = useState(false);
  const [pushingGarmin, setPushingGarmin] = useState(false);
  const [garminPushMessage, setGarminPushMessage] = useState<string | null>(null);
  /** e.g. navigate to /workouts/[id] failed — does not mean the day is unscheduled */
  const [openWorkoutError, setOpenWorkoutError] = useState<string | null>(null);
  const [raceResultRow, setRaceResultRow] = useState<{
    id: string;
    officialFinishTime: string | null;
  } | null>(null);
  const [logRaceOpen, setLogRaceOpen] = useState(false);
  const [showMatchPanel, setShowMatchPanel] = useState(false);
  const [matchedActivityId, setMatchedActivityId] = useState<string | null>(null);
  const [skippedAt, setSkippedAt] = useState<string | null>(null);
  const [loggedActualDistanceMeters, setLoggedActualDistanceMeters] = useState<number | null>(
    null
  );
  const [loggedActualPaceSecPerMile, setLoggedActualPaceSecPerMile] = useState<number | null>(
    null
  );
  const [loggedActualDurationSeconds, setLoggedActualDurationSeconds] = useState<number | null>(
    null
  );
  const [loggedTargetPaceSecPerMile, setLoggedTargetPaceSecPerMile] = useState<number | null>(null);
  const [loggedTargetPaceSecPerMileHigh, setLoggedTargetPaceSecPerMileHigh] = useState<
    number | null
  >(null);
  const [loggedPlannedDistanceMeters, setLoggedPlannedDistanceMeters] = useState<number | null>(
    null
  );

  const hubBackHref =
    sourceSetup && planDetail
      ? `/training-setup/${planDetail.id}`
      : sourceHome
        ? "/athlete-home"
        : TRAINING_HUB_BACK_PATH;
  const hubBackLabel = sourceSetup
    ? "Back to plan setup"
    : sourceHome
      ? "Back to Home"
      : "Back to Training Hub";

  const prevDateKey = dateKey ? shiftDateKey(dateKey, -1) : null;
  const nextDateKey = dateKey ? shiftDateKey(dateKey, 1) : null;

  const querySuffix = useMemo(() => {
    const parts = new URLSearchParams();
    if (planIdFromQuery) parts.set("planId", planIdFromQuery);
    if (sourceSetup) parts.set("source", "setup");
    else if (sourceHome) parts.set("source", "home");
    const s = parts.toString();
    return s ? `?${s}` : "";
  }, [planIdFromQuery, sourceSetup, sourceHome]);

  const load = useCallback(async () => {
    if (!dateKey) {
      setError("Invalid date");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPlanDetail(null);
    setWorkout(null);
    setWorkoutId(null);
    setWorkoutError(null);
    setWorkoutDetailError(null);
    setOpenWorkoutError(null);
    setGarminPushMessage(null);
    setMatchedActivityId(null);
    setLoggedActualDistanceMeters(null);
    setLoggedActualPaceSecPerMile(null);
    setLoggedActualDurationSeconds(null);
    setLoggedPlannedDistanceMeters(null);
    setLoggedTargetPaceSecPerMile(null);
    setLoggedTargetPaceSecPerMileHigh(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();

      let planId = planIdFromQuery;
      if (!planId) {
        const listRes = await fetch("/api/training-plan?status=active", {
          headers: athleteBearerFetchHeaders(token),
        });
        const listData = await listRes.json();
        if (!listRes.ok || !Array.isArray(listData.plans) || listData.plans.length === 0) {
          setError("No active training plan.");
          setLoading(false);
          return;
        }
        planId = (listData.plans[0] as { id: string }).id;
      }

      const { plan: raw } = await fetchTrainingPlanDetail(planId!, token);
      const plan = raw as PlanDetail;
      if (!hasSchedule(plan)) {
        setError("This plan has no schedule yet.");
        setLoading(false);
        return;
      }

      setPlanDetail(plan);
      setRaceResultRow(null);

      setWorkoutLoading(true);
      try {
        const wid = await resolveWorkoutForPlanDay(plan.id, dateKey, token);
        setWorkoutId(wid);
        setWorkoutError(null);
        let raceDayPayload: ReturnType<typeof pickWorkoutPayload> | null = null;
        try {
          const { workout: rawW } = await fetchTrainingWorkoutDetail(wid, token);
          raceDayPayload = pickWorkoutPayload(rawW);
          setWorkout(raceDayPayload);
          const rawRecord = rawW as Record<string, unknown>;
          const mid = rawRecord.matchedActivityId;
          setMatchedActivityId(typeof mid === "string" && mid.trim() ? mid.trim() : null);
          const skip = rawRecord.skippedAt;
          setSkippedAt(typeof skip === "string" && skip.trim() ? skip.trim() : null);
          const dist = rawRecord.actualDistanceMeters;
          setLoggedActualDistanceMeters(
            typeof dist === "number" && Number.isFinite(dist) && dist > 0 ? dist : null
          );
          const pace = rawRecord.actualAvgPaceSecPerMile;
          setLoggedActualPaceSecPerMile(
            typeof pace === "number" && Number.isFinite(pace) && pace > 0 ? pace : null
          );
          const dur = rawRecord.actualDurationSeconds;
          setLoggedActualDurationSeconds(
            typeof dur === "number" && Number.isFinite(dur) && dur > 0 ? dur : null
          );
          const planned = rawRecord.estimatedDistanceInMeters;
          setLoggedPlannedDistanceMeters(
            typeof planned === "number" && Number.isFinite(planned) && planned > 0 ? planned : null
          );
          const tp = rawRecord.targetPaceSecPerMile;
          setLoggedTargetPaceSecPerMile(
            typeof tp === "number" && Number.isFinite(tp) && tp > 0 ? tp : null
          );
          const tph = rawRecord.targetPaceSecPerMileHigh;
          setLoggedTargetPaceSecPerMileHigh(
            typeof tph === "number" && Number.isFinite(tph) && tph > 0 ? tph : null
          );
          setWorkoutDetailError(null);
        } catch (e) {
          setWorkout(null);
          setWorkoutDetailError(
            e instanceof Error ? e.message : "Could not load workout detail"
          );
        }

        const regId = (plan as PlanDetail).race_registry?.id;
        if (regId && raceDayPayload?.workoutType === "Race") {
          try {
            const rr = await fetch(
              `/api/race-results?raceRegistryId=${encodeURIComponent(regId)}`,
              { headers: athleteBearerFetchHeaders(token) }
            );
            const rrJson = (await rr.json()) as { results?: { id: string; officialFinishTime: string | null }[] };
            if (rr.ok && Array.isArray(rrJson.results) && rrJson.results[0]) {
              setRaceResultRow({
                id: rrJson.results[0].id,
                officialFinishTime: rrJson.results[0].officialFinishTime ?? null,
              });
            }
          } catch {
            setRaceResultRow(null);
          }
        }
      } catch (e) {
        setWorkoutId(null);
        setWorkout(null);
        setWorkoutError(e instanceof Error ? e.message : "Could not load workout");
      } finally {
        setWorkoutLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [dateKey, planIdFromQuery]);

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
    if (!authReady || !dateKey) return;
    void load();
  }, [authReady, dateKey, load]);

  const isRaceDay = workout?.workoutType === "Race";
  const title = workout?.title?.trim() || "Workout";
  const typeDisplay = formatPreviewWorkoutTypeLabel(
    workout?.workoutType ?? "",
    isRaceDay
  );
  const plannedDateLabel = dateKey
    ? formatPlanDateDisplay(dateKey, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "—";
  const weekNumberDisplay =
    workout?.weekNumber != null && Number.isFinite(workout.weekNumber)
      ? workout.weekNumber
      : "—";
  const isCalendarToday = dateKey != null && dateKey === localYmd(new Date());
  const isPastPlanDay = dateKey != null && dateKey < localYmd(new Date());
  const planRace = planDetail?.race_registry;
  const showRaceResultCta = Boolean(
    isRaceDay && isPastPlanDay && planRace?.id
  );
  const planRaceYmd = planRace?.raceDate
    ? ymdFromDate(
        /^\d{4}-\d{2}-\d{2}$/.test(String(planRace.raceDate).slice(0, 10))
          ? new Date(`${String(planRace.raceDate).slice(0, 10)}T12:00:00Z`)
          : new Date(planRace.raceDate)
      )
    : dateKey ?? "";
  const canOpenWorkout = workoutId != null;
  const canMatchWorkout =
    workoutId != null && !workoutLoading && !workoutError && matchedActivityId == null;
  const isLogged = matchedActivityId != null;
  const dayStatus =
    dateKey != null
      ? deriveSessionStatus({
          dateKey,
          matchedActivityId,
          skippedAt,
          workoutType: workout?.workoutType,
          title: workout?.title,
        })
      : null;
  const isActionableWorkout = dayStatus === "today";
  const showTodaysWorkoutHeader =
    (sourceHome && isActionableWorkout) || isCalendarToday;

  const loggedRunStatus = buildRunResultStatus({
    plannedDistanceMeters: loggedPlannedDistanceMeters,
    actualDistanceMeters: loggedActualDistanceMeters,
    actualAvgPaceSecPerMile: loggedActualPaceSecPerMile,
    targetPaceSecPerMile: loggedTargetPaceSecPerMile,
    targetPaceSecPerMileHigh: loggedTargetPaceSecPerMileHigh,
  });

  useEffect(() => {
    if (!authReady || loading || !matchedActivityId || !workoutId) return;
    const back =
      sourceSetup && planDetail
        ? `/training-setup/${planDetail.id}`
        : sourceHome
          ? "/athlete-home"
          : TRAINING_HUB_BACK_PATH;
    router.replace(workoutDetailPathWithBackHref(workoutId, back));
  }, [
    authReady,
    loading,
    matchedActivityId,
    workoutId,
    sourceSetup,
    sourceHome,
    planDetail,
    router,
  ]);

  function openMatchPanel() {
    setShowMatchPanel(true);
    requestAnimationFrame(() => {
      document.getElementById("match-garmin-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function pushWorkoutIdToGarmin(wid: string, token: string, showSuccess: boolean) {
    const res = await fetch(`/api/workouts/${encodeURIComponent(wid)}/push-to-garmin`, {
      method: "POST",
      headers: athleteBearerFetchHeaders(token),
    });
    const data = (await res.json()) as {
      error?: string;
      details?: string;
      scheduledDate?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || data.details || "Could not send to Garmin");
    }
    if (showSuccess) {
      setGarminPushMessage(
        data.scheduledDate
          ? `Added to your Garmin Connect calendar for ${data.scheduledDate}. Sync your watch in Garmin Connect.`
          : "Added to your Garmin Connect calendar. Sync your watch in Garmin Connect."
      );
    }
  }

  async function handlePushToGarmin() {
    if (!planDetail || !dateKey) return;
    const u = auth.currentUser;
    if (!u) return;
    setPushingGarmin(true);
    setGarminPushMessage(null);
    setOpenWorkoutError(null);
    try {
      const token = await u.getIdToken();
      const wid =
        workoutId ?? (await resolveWorkoutForPlanDay(planDetail.id, dateKey, token));
      if (!workoutId) setWorkoutId(wid);
      await pushWorkoutIdToGarmin(wid, token, true);
      try {
        const { workout: rawW } = await fetchTrainingWorkoutDetail(wid, token);
        setWorkout(pickWorkoutPayload(rawW));
        setWorkoutDetailError(null);
      } catch {
        // Push succeeded; detail refresh is helpful but not required.
      }
    } catch (e) {
      setGarminPushMessage(e instanceof Error ? e.message : "Could not send to Garmin");
    } finally {
      setPushingGarmin(false);
    }
  }

  async function handleDoThisWorkout() {
    if (!planDetail || !dateKey) return;
    const u = auth.currentUser;
    if (!u) return;
    setOpeningWorkout(true);
    setOpenWorkoutError(null);
    try {
      const token = await u.getIdToken();
      const wid =
        workoutId ?? (await resolveWorkoutForPlanDay(planDetail.id, dateKey, token));
      stashWorkoutDayNav(wid, {
        source: "training-hub",
        backPath:
          sourceSetup && planDetail
            ? `/training-setup/${planDetail.id}`
            : sourceHome
              ? "/athlete-home"
              : TRAINING_HUB_BACK_PATH,
      });
      router.push(`/workouts/${wid}`);
    } catch (e) {
      setOpenWorkoutError(e instanceof Error ? e.message : "Could not open workout");
    } finally {
      setOpeningWorkout(false);
    }
  }

  return (
    <AthleteAppShell>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <Link
          href={hubBackHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {hubBackLabel}
        </Link>

        {!dateKey && (
          <p className="text-sm text-red-600" role="alert">
            Invalid date in URL.
          </p>
        )}

        {dateKey && loading && (
          <p className="text-sm text-gray-500">
            {sourceHome ? "Loading today's workout…" : "Loading plan day…"}
          </p>
        )}

        {dateKey && error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {dateKey && !loading && !error && planDetail && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              {isLogged ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Workout logged
                </p>
              ) : showTodaysWorkoutHeader && sourceHome ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Today&apos;s workout
                </p>
              ) : showTodaysWorkoutHeader ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  {"Here's your work for today"}
                </p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Planned in your schedule
                </p>
              )}
              {planDetail.name?.trim() && !(sourceHome && showTodaysWorkoutHeader) ? (
                <p className="mt-0.5 text-xs text-gray-600 truncate">{planDetail.name}</p>
              ) : null}
              {isRaceDay ? (
                <p className="mt-2 inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-900">
                  Race day
                </p>
              ) : null}
              <h1 className="mt-2 text-xl font-semibold text-gray-900 leading-snug">{title}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Week {weekNumberDisplay} of {planDetail.totalWeeks} · {plannedDateLabel}
                {isLogged ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    Logged
                  </span>
                ) : null}
              </p>
              {workout && typeDisplay ? (
                <p className="mt-0.5 text-xs text-gray-500">{typeDisplay}</p>
              ) : null}
              {workout?.description?.trim() ? (
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{workout.description}</p>
              ) : null}
            </div>

            <div className="px-5 py-4 space-y-4">
              {isLogged ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-gray-800 space-y-1">
                  <p className="font-medium text-emerald-900">This workout is logged.</p>
                  {loggedActualDistanceMeters != null ? (
                    <p className="tabular-nums">
                      Ran: {metersToMiDisplay(loggedActualDistanceMeters)}
                    </p>
                  ) : null}
                  {loggedRunStatus.distanceMessage ? (
                    <p className="tabular-nums text-gray-700">{loggedRunStatus.distanceMessage}</p>
                  ) : null}
                  {loggedRunStatus.paceMessage ? (
                    <p className="tabular-nums text-gray-700">{loggedRunStatus.paceMessage}</p>
                  ) : null}
                  {loggedActualPaceSecPerMile != null ? (
                    <p className="tabular-nums">
                      Pace: {formatSecPerMile(loggedActualPaceSecPerMile)}
                    </p>
                  ) : null}
                  {formatDurationSeconds(loggedActualDurationSeconds) ? (
                    <p className="tabular-nums">
                      Time: {formatDurationSeconds(loggedActualDurationSeconds)}
                    </p>
                  ) : null}
                  <p className="text-gray-600 pt-1">
                    Review your run on the workout page. Add run context there to get coach feedback.
                  </p>
                </div>
              ) : null}
              {workoutLoading && (
                <p className="text-sm text-gray-500">Loading workout details…</p>
              )}
              {workoutError && (
                <p className="text-sm text-red-600" role="alert">
                  {workoutError}
                </p>
              )}
              {workoutDetailError && workoutId && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2" role="status">
                  {workoutDetailError} — you can still open the full workout.
                </p>
              )}
              {openWorkoutError && (
                <p className="text-sm text-red-600" role="alert">
                  {openWorkoutError}
                </p>
              )}
              {garminPushMessage && (
                <p className="text-sm font-medium text-emerald-900 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
                  {garminPushMessage}
                </p>
              )}
              {!isLogged && !workoutLoading && workout && workout.segments.length === 0 && (
                <p className="text-sm text-gray-600">
                  No structured steps yet for this workout type. You can still open the full workout
                  to set up your run or see more detail.
                </p>
              )}
              {!isLogged && !workoutLoading && workout && workout.segments.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                    {showTodaysWorkoutHeader ? "Today's workout" : "Workout structure"}
                  </p>
                  <ul className="space-y-1.5 list-none pl-0 m-0">
                    {groupSegmentsForDisplay(workout.segments).map((group, index) => {
                      const segment = group.work;
                      const multiStepRepeat = isMultiStepRepeatGroup(group);
                      const paceLine = previewGroupedSegmentTargetSummary(group);
                      const distanceLine = formatGroupedSegmentDuration(group);
                      const recoveryLine = previewGroupedRecoveryDistanceLine(group);
                      const sideTag = humanPlanStepSideTag(segment.title);
                      const groupTitle = humanDisplayGroupTitle(group, workout.workoutType);
                      return (
                        <li
                          key={`${segment.id}:${group.recovery?.id ?? ""}`}
                          className="overflow-hidden rounded-lg border border-gray-100"
                        >
                          <div
                            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide ${multiStepRepeat ? "bg-orange-500 text-white" : segmentHeaderClass(segment.title, workout.workoutType)}`}
                          >
                            {groupTitle}
                          </div>
                          <div className="flex items-center gap-2.5 bg-white px-3 py-2">
                            <span className="w-4 shrink-0 text-sm font-bold tabular-nums text-gray-400">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              {multiStepRepeat && group.cycleSteps ? (
                                <ul className="space-y-1 list-none pl-0 m-0">
                                  {group.cycleSteps.map((step) => (
                                    <li key={step.id} className="text-sm font-semibold text-gray-900">
                                      {formatSegmentDuration(step)}
                                      {previewSegmentTargetSummary(step) ? (
                                        <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                                          {previewSegmentTargetSummary(step)}
                                        </span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <>
                                  <span className="text-sm font-semibold text-gray-900">
                                    {distanceLine}
                                  </span>
                                  {paceLine ? (
                                    <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                                      {paceLine}
                                    </span>
                                  ) : null}
                                </>
                              )}
                              {recoveryLine ? (
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {formatBetweenRepeatsRecoveryLabel(group)
                                    ? recoveryLine
                                    : `Between reps: ${recoveryLine}`}
                                </p>
                              ) : null}
                            </div>
                            {sideTag ? (
                              <span className="shrink-0 text-[10px] font-semibold tracking-wide text-gray-400">
                                {sideTag}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {showRaceResultCta && planRace ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-3 space-y-2">
                  {raceResultRow?.officialFinishTime ? (
                    <p className="text-sm font-medium text-emerald-900 tabular-nums">
                      Your logged time: {raceResultRow.officialFinishTime}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-800">
                      Log your official finish time — even if your watch didn&apos;t record this as a
                      race.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setLogRaceOpen(true)}
                    className="inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    {raceResultRow ? "Update result" : "Log your result"}
                  </button>
                </div>
              ) : null}

              {!isLogged && showMatchPanel && canMatchWorkout && workoutId ? (
                <div id="match-garmin-panel" className="space-y-4">
                  {dayStatus === "missed" || dayStatus === "skipped" ? (
                    <WorkoutSkipActions
                      workoutId={workoutId}
                      dateKey={dateKey ?? ""}
                      matchedActivityId={matchedActivityId}
                      skippedAt={skippedAt}
                      workoutType={workout?.workoutType}
                      title={title}
                      showMissedPrompt={dayStatus === "missed"}
                      onUpdated={load}
                    />
                  ) : null}
                  <WorkoutActivityMatchPanel
                    workoutId={workoutId}
                    workoutTitle={title}
                    plannedDistanceMeters={workout?.estimatedDistanceInMeters ?? null}
                    compact
                    onMatched={load}
                    onClose={() => setShowMatchPanel(false)}
                  />
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/60">
              {isLogged && workoutId ? (
                <Link
                  href={workoutDetailPathWithBackHref(workoutId, hubBackHref)}
                  className="block w-full text-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Review run
                </Link>
              ) : null}
              {!isLogged && canMatchWorkout ? (
                <button
                  type="button"
                  onClick={openMatchPanel}
                  className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  I did this workout
                </button>
              ) : null}
              {!isLogged && isActionableWorkout ? (
                <button
                  type="button"
                  onClick={() => void handlePushToGarmin()}
                  disabled={pushingGarmin || workoutLoading || !!workoutError}
                  className="w-full rounded-xl border border-orange-200 bg-white py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                >
                  {pushingGarmin ? "Sending to Garmin..." : "Send to Garmin"}
                </button>
              ) : null}
              {!isLogged ? (
                <button
                  type="button"
                  onClick={() => void handleDoThisWorkout()}
                  disabled={openingWorkout || !canOpenWorkout || workoutLoading || !!workoutError}
                  className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {openingWorkout ? "Opening…" : "Open workout details"}
                </button>
              ) : null}
              {!isLogged && canMatchWorkout ? (
                <button
                  type="button"
                  onClick={openMatchPanel}
                  className="w-full rounded-xl border border-sky-200 bg-white py-3 text-sm font-semibold text-sky-800 hover:bg-sky-50"
                >
                  Match Garmin activity
                </button>
              ) : null}
              <div className="flex gap-2">
                {prevDateKey && (
                  <Link
                    href={`/training/day/${prevDateKey}${querySuffix}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                    Previous day
                  </Link>
                )}
                {nextDateKey && (
                  <Link
                    href={`/training/day/${nextDateKey}${querySuffix}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Next day
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                )}
              </div>
              <Link
                href={hubBackHref}
                className="block w-full text-center rounded-xl border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Training Hub
              </Link>
            </div>
          </div>
        )}
      </div>
      {showRaceResultCta && planRace ? (
        <LogRaceResultSheet
          open={logRaceOpen}
          onClose={() => setLogRaceOpen(false)}
          raceRegistryId={planRace.id}
          raceName={planRace.name}
          raceDateYmd={planRaceYmd}
          goalId={planDetail?.athlete_goal?.id ?? null}
          signupId={null}
          onSaved={() => {
            void load();
            setLogRaceOpen(false);
          }}
        />
      ) : null}
    </AthleteAppShell>
  );
}
