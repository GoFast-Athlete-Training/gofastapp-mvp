'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Footprints,
  MapPin,
  Mountain,
  Timer,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import Image from 'next/image';
import api from '@/lib/api';
import Link from 'next/link';
import {
  formatPaceTargetRangeForDisplay,
  formatPaceTargetSingleForDisplay,
  normalizePaceTargetEncodingVersion,
  RACE_DISTANCES_MILES,
} from '@/lib/workout-generator/pace-calculator';
import { metersToMiDisplay } from '@/lib/training/workout-preview-payload';
import {
  fetchTrainingPlanDetail,
  fetchPlanWeekSchedule,
  type PlanDayCard,
} from '@/lib/training/fetch-plan-week-client';
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  formatPlanDateDisplay,
  utcDateOnly,
  ymdFromDate,
} from '@/lib/training/plan-utils';
import { formatPlannedWorkoutTitle } from '@/lib/training/workout-display-title';
import { normalizeDistanceForPace } from '@/lib/pace-utils';

function homeSessionPaceLabel(
  segments:
    | {
        stepOrder: number;
        targets: unknown;
        paceTargetEncodingVersion?: number;
      }[]
    | undefined
): string | null {
  if (!segments?.length) return null;
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const arr = seg.targets as
      | { type?: string; valueLow?: number; valueHigh?: number; value?: number }[]
      | null;
    if (!Array.isArray(arr) || !arr[0]) continue;
    const t = arr[0];
    if (String(t.type || '').toUpperCase() !== 'PACE') continue;
    const low = t.valueLow ?? t.value;
    const high = t.valueHigh;
    const enc = normalizePaceTargetEncodingVersion(seg.paceTargetEncodingVersion);
    if (low != null && typeof low === 'number' && high != null && typeof high === 'number') {
      return formatPaceTargetRangeForDisplay(low, high, enc);
    }
    if (low != null && typeof low === 'number') {
      return formatPaceTargetSingleForDisplay(low, enc);
    }
  }
  return null;
}

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
}

function formatDurationMin(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.round(sec / 60);
  return m > 0 ? `${m} min` : null;
}

function homeLastRunDayLabel(activityStartTime: string | null, date: string | null): string {
  const raw = activityStartTime ?? date;
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/** target − actual (sec/mi); positive = faster than target */
function homeBeatTargetLine(delta: number | null | undefined): string | null {
  if (delta != null && Number.isFinite(delta)) {
    const n = Math.round(delta);
    const abs = Math.abs(n);
    if (n > 0) return `Beat target by ${abs} sec/mi`;
    if (n < 0) return `${abs} sec/mi slower than target`;
    return 'On target pace';
  }
  return null;
}

/** Title-case distance labels (marathon → Marathon, half marathon → Half Marathon). */
function normalizeGoalDistanceLabel(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  return s
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part.length ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
        )
        .join('-')
    )
    .join(' ');
}

type ActivePlanSummary = { name: string; hasSchedule: boolean };
type GoingRunRow = { id: string; title: string; date: string; city: string };

/** From GET /api/race-signups — athlete self-declared races + registry snapshot */
type RaceSignupWithRegistry = {
  id: string;
  raceRegistryId: string;
  race_registry: {
    id: string;
    name: string;
    distanceLabel: string | null;
    distanceMeters: number | null;
    raceDate: string;
    city: string | null;
    state: string | null;
    country: string | null;
    registrationUrl: string | null;
    startTime: string | null;
  };
};

function planDayMilesHome(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return '—';
  const mi = meters / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  return `${mi.toFixed(1)} mi`;
}

const MILES_5K_RIEGEL = RACE_DISTANCES_MILES['5k'] ?? 3.10686;

function workoutTypeMeta(workoutType: string): { Icon: LucideIcon; label: string } {
  switch (workoutType) {
    case 'Easy':
      return { Icon: Wind, label: 'Easy run' };
    case 'Tempo':
      return { Icon: Zap, label: 'Tempo' };
    case 'Intervals':
      return { Icon: Timer, label: 'Intervals' };
    case 'LongRun':
      return { Icon: Mountain, label: 'Long run' };
    default:
      return { Icon: Footprints, label: 'Workout' };
  }
}

/** Parse "6:48/mi" or "6:48" style pace → sec/mile */
function parsePaceStringToSecPerMile(pace: string): number | null {
  const t = pace.trim();
  const m = t.match(/^(\d+):(\d{2})/);
  if (!m) return null;
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return sec > 0 ? sec : null;
}

function formatFinishClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Riegel projection: current 5K pace → estimated race time & avg pace at goal distance.
 */
function projectRaceFromFiveKPace(
  fiveKPaceStr: string,
  eventMiles: number
): { projectedFinish: string; projectedPace: string } | null {
  const secPerMile = parsePaceStringToSecPerMile(fiveKPaceStr);
  if (!secPerMile || !Number.isFinite(eventMiles) || eventMiles <= 0) return null;
  const fiveKSec = secPerMile * MILES_5K_RIEGEL;
  const projSec = Math.round(fiveKSec * Math.pow(eventMiles / MILES_5K_RIEGEL, 1.06));
  const paceSecPerMile = projSec / eventMiles;
  return {
    projectedFinish: formatFinishClock(projSec),
    projectedPace: formatSecPerMile(Math.round(paceSecPerMile)),
  };
}

type LastLoggedWorkoutStrip = {
  id: string;
  title: string;
  workoutType?: string;
  date: string | null;
  activityStartTime: string | null;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  paceDeltaSecPerMile: number | null;
};

export default function AthleteHomePage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [garminConnected, setGarminConnected] = useState(false);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryGoal, setPrimaryGoal] = useState<any>(null);
  const [paceNotifications, setPaceNotifications] = useState<
    {
      id: string;
      adjustmentSecPerMile: number;
      summaryMessage: string | null;
    }[]
  >([]);
  const [activePlanSummary, setActivePlanSummary] = useState<ActivePlanSummary | null>(null);
  const [myGoingRuns, setMyGoingRuns] = useState<GoingRunRow[]>([]);
  const [lastLoggedWorkout, setLastLoggedWorkout] = useState<LastLoggedWorkoutStrip | null>(null);
  const [lastFallbackActivity, setLastFallbackActivity] = useState<{
    id: string;
    activityName: string | null;
    activityType: string | null;
    startTime: string | null;
    distance: number | null;
  } | null>(null);
  const [todayPlanDay, setTodayPlanDay] = useState<PlanDayCard | null>(null);
  const [raceSignups, setRaceSignups] = useState<RaceSignupWithRegistry[]>([]);

  const loadHome = useCallback(async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.replace('/welcome');
      return;
    }

    setLoading(true);

    let row: any = null;
    try {
      const profileRes = await api.get(`/athlete/${athleteId}`);
      row = profileRes.data?.athlete;
      if (!row) {
        router.replace('/welcome');
        return;
      }
      setAthlete(row);
    } catch (profileErr: any) {
      const status = profileErr?.response?.status;
      if (status === 404 || status === 401) {
        router.replace('/welcome');
        return;
      }
      console.error('athlete-home: profile fetch failed', profileErr);
      setLoading(false);
      return;
    }

    const [goalsRes, upcomingRes, paceRes, goingRes, lastRunRes, raceSignupsRes] =
      await Promise.allSettled([
        api.get('/goals?status=ACTIVE'),
        api.get('/training/upcoming'),
        api.get(`/athlete/${athleteId}/pace-notifications`),
        api.get('/me/my-going-runs'),
        api.get('/me/last-logged-workout'),
        api.get('/race-signups'),
      ]);

    if (goalsRes.status === 'fulfilled') {
      const goals = goalsRes.value.data?.goals ?? [];
      setPrimaryGoal(goals[0] ?? null);
    } else {
      console.warn('athlete-home: goals fetch failed', goalsRes.reason);
    }

    if (upcomingRes.status === 'fulfilled') {
      const d = upcomingRes.value.data as {
        sessions?: unknown[];
        activePlanSummary?: ActivePlanSummary | null;
      };
      setUpcomingSessions(Array.isArray(d.sessions) ? d.sessions : []);
      setActivePlanSummary(
        d.activePlanSummary && typeof d.activePlanSummary.name === 'string'
          ? d.activePlanSummary
          : null
      );
    } else {
      console.warn('athlete-home: upcoming training fetch failed', upcomingRes.reason);
      setUpcomingSessions([]);
      setActivePlanSummary(null);
    }

    if (goingRes.status === 'fulfilled') {
      const runs = goingRes.value.data?.runs;
      setMyGoingRuns(Array.isArray(runs) ? runs : []);
    } else {
      setMyGoingRuns([]);
    }

    if (paceRes.status === 'fulfilled') {
      setPaceNotifications(paceRes.value.data?.notifications ?? []);
    } else {
      setPaceNotifications([]);
    }

    if (raceSignupsRes.status === 'fulfilled') {
      const list = raceSignupsRes.value.data?.signups;
      setRaceSignups(Array.isArray(list) ? (list as RaceSignupWithRegistry[]) : []);
    } else {
      console.warn('athlete-home: race signups fetch failed', raceSignupsRes.reason);
      setRaceSignups([]);
    }

    if (lastRunRes.status === 'fulfilled') {
      const data = lastRunRes.value.data as {
        workout?: LastLoggedWorkoutStrip | null;
        fallbackActivity?: {
          id: string;
          activityName?: string | null;
          activityType?: string | null;
          startTime?: string | null;
          distance?: number | null;
        } | null;
      };
      const w = data?.workout;
      if (w && typeof w.id === 'string' && typeof w.title === 'string') {
        setLastLoggedWorkout(w);
        setLastFallbackActivity(null);
      } else {
        setLastLoggedWorkout(null);
        const fa = data?.fallbackActivity;
        if (fa?.id) {
          setLastFallbackActivity({
            id: fa.id,
            activityName: fa.activityName ?? null,
            activityType: fa.activityType ?? null,
            startTime: fa.startTime ?? null,
            distance: fa.distance ?? null,
          });
        } else {
          setLastFallbackActivity(null);
        }
      }
    } else {
      setLastLoggedWorkout(null);
      setLastFallbackActivity(null);
    }

    let todayPlan: PlanDayCard | null = null;
    const upcomingData =
      upcomingRes.status === 'fulfilled'
        ? (upcomingRes.value.data as {
            activePlanSummary?: ActivePlanSummary | null;
          })
        : null;
    const hasSchedule = Boolean(upcomingData?.activePlanSummary?.hasSchedule);
    if (hasSchedule) {
      try {
        const listRes = await api.get('/training-plan?status=active');
        const plans = listRes.data?.plans as { id: string }[] | undefined;
        const planId = Array.isArray(plans) && plans[0]?.id ? plans[0].id : null;
        const u = auth.currentUser;
        if (planId && u) {
          const token = await u.getIdToken();
          const { plan: raw } = await fetchTrainingPlanDetail(planId, token);
          const p = raw as {
            startDate: string;
            totalWeeks: number;
            race_registry?: { raceDate?: string } | null;
          };
          const eff = effectiveTrainingWeekCount(
            new Date(p.startDate),
            p.totalWeeks,
            p.race_registry?.raceDate ? new Date(p.race_registry.raceDate) : null
          );
          const wn = currentTrainingWeekNumber(p.startDate, eff);
          const { days } = await fetchPlanWeekSchedule(planId, wn, token);
          const todayKey = ymdFromDate(utcDateOnly(new Date()));
          todayPlan = days.find((d) => d.dateKey === todayKey) ?? null;
        }
      } catch (e) {
        console.warn('athlete-home: today plan day fetch failed', e);
      }
    }
    setTodayPlanDay(todayPlan);

    const garminFromStorage =
      typeof window !== 'undefined' && localStorage.getItem('garminConnected') === 'true';
    setGarminConnected(!!row.garmin_connected || garminFromStorage);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace('/signup');
      }
    });
    return () => unsub();
  }, [router]);

  const handleConnectGarmin = async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setConnectingGarmin(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to connect Garmin');
        setConnectingGarmin(false);
        return;
      }
      const firebaseToken = await currentUser.getIdToken();

      const response = await fetch(`/api/auth/garmin/authorize?athleteId=${athleteId}&popup=true`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${firebaseToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || 'Failed to get auth URL');
      }

      const data = await response.json();
      if (!data.authUrl) {
        throw new Error(data.error || 'Invalid response from server');
      }

      const popup = window.open(data.authUrl, 'garmin-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setConnectingGarmin(false);
        return;
      }

      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setConnectingGarmin(false);
          void loadHome();
        }
      }, 500);

      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'GARMIN_OAUTH_SUCCESS') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          setGarminConnected(true);
          localStorage.setItem('garminConnected', 'true');
          void loadHome();
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'GARMIN_OAUTH_ERROR') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          alert('Failed to connect Garmin: ' + (event.data.error || 'Unknown error'));
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);
    } catch (error: any) {
      console.error('Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
      setConnectingGarmin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to continue</p>
          <button
            onClick={() => router.replace('/signup')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const goalDaysLeft =
    primaryGoal?.targetByDate != null
      ? Math.max(
          0,
          Math.ceil((new Date(primaryGoal.targetByDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

  const nextTraining =
    upcomingSessions.find((s: { isPlanSession?: boolean }) => s.isPlanSession) ??
    upcomingSessions[0] ??
    null;
  const nextTrainingHref =
    nextTraining?.workoutId && String(nextTraining.workoutId).length > 0
      ? `/workouts/${nextTraining.workoutId}`
      : '/training';
  const nextTrainingDay =
    nextTraining?.date != null
      ? new Date(nextTraining.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;
  const nextTrainingPace = nextTraining ? homeSessionPaceLabel(nextTraining.segments) : null;

  const nextGoingRun = myGoingRuns[0] ?? null;
  const nextGoingDay =
    nextGoingRun?.date != null
      ? new Date(nextGoingRun.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

  const raceName = primaryGoal?.race_registry?.name ?? null;
  const raceDateStr =
    primaryGoal?.targetByDate != null
      ? new Date(primaryGoal.targetByDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const showTrainingAtGlance =
    Boolean(activePlanSummary?.hasSchedule) || Boolean(primaryGoal);

  const goalDistanceNorm = normalizeGoalDistanceLabel(primaryGoal?.distance);

  const todayUtcForRace = utcDateOnly(new Date());
  const raceDaySignupForHome = raceSignups.find((s) => {
    const rd = utcDateOnly(new Date(s.race_registry.raceDate));
    return rd.getTime() === todayUtcForRace.getTime();
  });
  const upcomingRaceSignupForHome = !raceDaySignupForHome
    ? raceSignups
        .filter((s) => {
          const rd = utcDateOnly(new Date(s.race_registry.raceDate));
          const diff = rd.getTime() - todayUtcForRace.getTime();
          return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
        })
        .sort(
          (a, b) =>
            new Date(a.race_registry.raceDate).getTime() -
            new Date(b.race_registry.raceDate).getTime()
        )[0]
    : undefined;
  const daysUntilUpcomingRace =
    upcomingRaceSignupForHome != null
      ? Math.round(
          (utcDateOnly(new Date(upcomingRaceSignupForHome.race_registry.raceDate)).getTime() -
            todayUtcForRace.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

  const cardFindRun =
    'block rounded-xl border-2 border-sky-200 bg-sky-50/70 p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition-all h-full';
  const cardTraining =
    'block rounded-xl border-2 border-emerald-200 bg-emerald-50/80 p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all h-full';

  const lastRunDayLabelHome = lastLoggedWorkout
    ? homeLastRunDayLabel(lastLoggedWorkout.activityStartTime, lastLoggedWorkout.date)
    : '';
  const lastRunBeatLineHome = lastLoggedWorkout
    ? homeBeatTargetLine(lastLoggedWorkout.paceDeltaSecPerMile)
    : null;
  const lastRunDurationHome = lastLoggedWorkout
    ? formatDurationMin(lastLoggedWorkout.actualDurationSeconds)
    : null;

  const fiveKPaceStr =
    typeof athlete?.fiveKPace === 'string' && athlete.fiveKPace.trim()
      ? athlete.fiveKPace.trim()
      : null;

  const distanceKeyForProjection =
    primaryGoal != null
      ? normalizeDistanceForPace(
          String(primaryGoal.distance ?? ''),
          primaryGoal.race_registry?.distanceMeters != null
            ? Number(primaryGoal.race_registry.distanceMeters)
            : null
        )
      : null;

  const eventMilesForProjection =
    distanceKeyForProjection && RACE_DISTANCES_MILES[distanceKeyForProjection] != null
      ? RACE_DISTANCES_MILES[distanceKeyForProjection]
      : primaryGoal?.race_registry?.distanceMeters != null &&
          Number.isFinite(Number(primaryGoal.race_registry.distanceMeters))
        ? Number(primaryGoal.race_registry.distanceMeters) / 1609.344
        : null;

  const paceProjection =
    fiveKPaceStr && eventMilesForProjection != null && eventMilesForProjection > 0
      ? projectRaceFromFiveKPace(fiveKPaceStr, eventMilesForProjection)
      : null;

  const raceLogoUrl =
    typeof primaryGoal?.race_registry?.logoUrl === 'string' && primaryGoal.race_registry.logoUrl.trim()
      ? primaryGoal.race_registry.logoUrl.trim()
      : null;
  const raceCity = primaryGoal?.race_registry?.city ?? null;
  const raceState = primaryGoal?.race_registry?.state ?? null;
  const raceCityState =
    [raceCity, raceState].filter((x) => x && String(x).trim()).join(', ') || null;

  let todayRunIcon = Footprints;
  let todayTypeLabel = 'Workout';
  let todayStoredTitleSubtitle: string | null = null;
  if (todayPlanDay) {
    const tm = workoutTypeMeta(todayPlanDay.workoutType);
    todayRunIcon = tm.Icon;
    todayTypeLabel = tm.label;
    const rawT = todayPlanDay.title.trim();
    const plannedTitle = formatPlannedWorkoutTitle(
      todayPlanDay.workoutType,
      todayPlanDay.estimatedDistanceInMeters
    );
    if (rawT && rawT !== plannedTitle) {
      todayStoredTitleSubtitle = rawT;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back, {athlete.firstName}!</h1>
              <p className="text-gray-600 text-sm">Here&apos;s your training at a glance</p>
            </div>

            {raceDaySignupForHome ? (
              <div className="mb-4 rounded-2xl border-2 border-violet-400 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4 min-w-0">
                    <Trophy className="h-12 w-12 shrink-0 text-amber-200" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-100">
                        Today is race day
                      </p>
                      <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                        {raceDaySignupForHome.race_registry.name}
                      </h2>
                      {raceDaySignupForHome.race_registry.distanceLabel ? (
                        <p className="mt-1 text-lg font-semibold text-violet-100">
                          {raceDaySignupForHome.race_registry.distanceLabel}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xl font-bold text-white">
                        Go get it
                        {typeof athlete?.firstName === 'string' && athlete.firstName.trim()
                          ? `, ${athlete.firstName.trim()}`
                          : ''}
                        !
                      </p>
                      {(() => {
                        const city = raceDaySignupForHome.race_registry.city;
                        const st = raceDaySignupForHome.race_registry.state;
                        const loc =
                          [city, st].filter((x) => x && String(x).trim()).join(', ') || null;
                        const stTime = raceDaySignupForHome.race_registry.startTime?.trim();
                        if (!loc && !stTime) return null;
                        return (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-violet-100">
                            {loc ? (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                {loc}
                              </span>
                            ) : null}
                            {stTime ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Timer className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                {stTime}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <Link
                    href={`/race-hub/${raceDaySignupForHome.race_registry.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow hover:bg-violet-50"
                  >
                    Open race hub
                  </Link>
                </div>
              </div>
            ) : upcomingRaceSignupForHome && daysUntilUpcomingRace != null && daysUntilUpcomingRace > 0 ? (
              <div className="mb-4 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                      Race in {daysUntilUpcomingRace} day{daysUntilUpcomingRace === 1 ? '' : 's'}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-gray-900">
                      {upcomingRaceSignupForHome.race_registry.name}
                    </h2>
                    {upcomingRaceSignupForHome.race_registry.distanceLabel ? (
                      <p className="text-sm text-gray-600">
                        {upcomingRaceSignupForHome.race_registry.distanceLabel}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-gray-700">
                      You&apos;ve put in the work. Race week is here.
                    </p>
                  </div>
                  <Link
                    href={`/race-hub/${upcomingRaceSignupForHome.race_registry.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Race hub
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Row 1: Today + Race goal */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
              <div className="lg:col-span-3">
                {todayPlanDay ? (
                  <div className="rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm h-full flex flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900">
                      Today&apos;s run
                    </p>
                    <div className="mt-3 flex items-start gap-3">
                      {(() => {
                        const Icon = todayRunIcon;
                        return <Icon className="h-9 w-9 shrink-0 text-orange-600" aria-hidden />;
                      })()}
                      <div className="min-w-0 flex-1">
                        <p className="text-2xl font-bold text-gray-900 leading-tight">{todayTypeLabel}</p>
                        <p className="text-lg font-semibold text-gray-800 tabular-nums mt-1">
                          {planDayMilesHome(todayPlanDay.estimatedDistanceInMeters)} total
                        </p>
                        {todayStoredTitleSubtitle ? (
                          <p className="text-xs text-gray-600 mt-2 italic leading-snug">
                            {todayStoredTitleSubtitle}
                            <span className="not-italic text-gray-500 block mt-1">
                              Plan details (intervals, structure) — total volume above.
                            </span>
                          </p>
                        ) : null}
                        <p className="text-sm text-gray-600 mt-2">
                          {formatPlanDateDisplay(todayPlanDay.dateKey || String(todayPlanDay.date), {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {todayPlanDay.matchedActivityId ? (
                            <span className="ml-2 font-semibold text-emerald-700">· Done</span>
                          ) : null}
                        </p>
                        <Link
                          href={`/training/day/${todayPlanDay.dateKey}`}
                          className="mt-4 inline-flex justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 w-full sm:w-auto"
                        >
                          Open today&apos;s session
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : activePlanSummary?.hasSchedule ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 shadow-sm h-full flex flex-col justify-center">
                    <p className="text-sm font-medium text-gray-800">No session on your schedule today</p>
                    <p className="text-gray-600 text-sm mt-1">Log a run or check your week in Training.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href="/workouts"
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Workouts →
                      </Link>
                      <Link href="/training" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
                        Week view →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-full">
                    <p className="text-sm text-gray-700">Start a plan to see today&apos;s sessions here.</p>
                    <Link
                      href="/training-setup"
                      className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Start or connect a plan →
                    </Link>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                {primaryGoal ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm h-full flex flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Race goal</p>
                    <div className="mt-2 flex gap-3 items-start">
                      {raceLogoUrl ? (
                        <img
                          src={raceLogoUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-contain shrink-0 border border-gray-100 bg-white"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-gray-900 leading-snug">
                          {raceName || 'Your goal'}
                        </h2>
                        {goalDistanceNorm ? (
                          <p className="text-xs text-gray-500 mt-0.5">{goalDistanceNorm}</p>
                        ) : null}
                        {raceCityState ? (
                          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                            {raceCityState}
                          </p>
                        ) : null}
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                          {raceDateStr ?? '—'}
                          {goalDaysLeft != null ? (
                            <span className="text-gray-500">
                              ·{' '}
                              {goalDaysLeft === 0
                                ? 'Race day'
                                : `${goalDaysLeft} day${goalDaysLeft === 1 ? '' : 's'} to go`}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm border-t border-gray-100 pt-3">
                      <div>
                        <dt className="text-gray-500 text-xs">Goal time</dt>
                        <dd className="font-semibold text-gray-900 tabular-nums">
                          {primaryGoal.goalTime?.trim() ? primaryGoal.goalTime : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 text-xs">Goal pace</dt>
                        <dd className="font-semibold text-gray-900 tabular-nums">
                          {primaryGoal.goalRacePace != null
                            ? formatSecPerMile(primaryGoal.goalRacePace)
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 text-xs">Current 5K</dt>
                        <dd className="font-semibold text-gray-900 tabular-nums">
                          {fiveKPaceStr ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 text-xs">Projected (from 5K)</dt>
                        <dd className="font-semibold text-gray-900 tabular-nums leading-tight">
                          {paceProjection ? (
                            <>
                              {paceProjection.projectedFinish}
                              <span className="block text-xs font-normal text-gray-600">
                                {paceProjection.projectedPace} avg
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href="/profile#goal"
                      className="mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Manage goal →
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 h-full flex flex-col justify-center">
                    <p className="text-sm text-gray-700">Set your race goal to anchor your plan.</p>
                    <Link
                      href="/profile#goal"
                      className="mt-2 inline-flex justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 w-full"
                    >
                      Set goal in profile
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Training + Find a run */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
              {showTrainingAtGlance ? (
                <div className={`${cardTraining} lg:col-span-3 cursor-default hover:border-emerald-200`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                    Training plan
                  </p>
                  {activePlanSummary?.name ? (
                    <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                      {activePlanSummary.name}
                    </h2>
                  ) : (
                    <h2 className="text-lg font-semibold text-gray-900 leading-snug">Your training</h2>
                  )}
                  <div className="mt-3 pt-3 border-t border-emerald-200/80">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 mb-2">
                      Next session
                    </p>
                    {nextTraining ? (
                      <>
                        <p className="text-base font-semibold text-gray-900 leading-snug">
                          {nextTraining.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {nextTrainingDay ?? 'Date TBD'}
                          {nextTraining.workoutType ? (
                            <>
                              {' '}
                              ·{' '}
                              <span className="capitalize">
                                {String(nextTraining.workoutType).toLowerCase()}
                              </span>
                            </>
                          ) : null}
                        </p>
                        {nextTrainingPace ? (
                          <p className="text-sm text-gray-700 mt-2">
                            Target <span className="font-medium">{nextTrainingPace}</span>
                          </p>
                        ) : null}
                        <Link
                          href={nextTrainingHref}
                          className="text-sm font-semibold text-emerald-800 mt-2 inline-block hover:underline"
                        >
                          Open workout →
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700">Nothing scheduled ahead in your plan.</p>
                        <Link
                          href="/training"
                          className="text-sm font-semibold text-emerald-800 mt-2 inline-block hover:underline"
                        >
                          Training hub →
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-emerald-900">
                    <Link href="/training" className="hover:underline">
                      Training hub
                    </Link>
                    <Link href="/profile#goal" className="hover:underline">
                      Goal
                    </Link>
                    <Link href="/workouts" className="hover:underline">
                      Workouts
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  className={`${cardTraining} lg:col-span-3 cursor-default hover:border-emerald-200 hover:shadow-sm`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                    Training plan
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900">Start your plan</h2>
                  <p className="text-sm text-gray-700 mt-2">
                    Connect a schedule from your goal or build workouts week by week.
                  </p>
                  <Link
                    href="/training-setup"
                    className="text-sm font-semibold text-emerald-800 mt-4 inline-block hover:underline"
                  >
                    Start or connect a plan →
                  </Link>
                </div>
              )}

              {nextGoingRun ? (
                <div className={`${cardFindRun} lg:col-span-2`}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-800 mb-2">
                    Find a run with others
                  </h2>
                  <p className="text-xs font-medium text-sky-900/80 mb-1">You&apos;re going</p>
                  <p className="text-base font-semibold text-gray-900 leading-snug">{nextGoingRun.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {nextGoingDay ?? 'Date TBD'}
                    {nextGoingRun.city ? ` · ${nextGoingRun.city}` : ''}
                  </p>
                  <Link
                    href={`/gorun/${nextGoingRun.id}`}
                    className="text-sm font-semibold text-sky-800 mt-3 inline-block hover:underline"
                  >
                    Open meetup →
                  </Link>
                  <p className="text-xs text-sky-900/70 mt-3 pt-3 border-t border-sky-200/80">
                    <Link href="/gorun" className="font-medium hover:underline">
                      Browse more runs →
                    </Link>
                  </p>
                </div>
              ) : (
                <Link href="/gorun" className={`${cardFindRun} lg:col-span-2`}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-800 mb-2">
                    Find a run with others
                  </h2>
                  <p className="text-gray-800 text-sm leading-relaxed">
                    RSVP to a community run and show up with a crew. No plan required.
                  </p>
                  <span className="text-sm font-semibold text-sky-800 mt-3 inline-block">
                    Browse runs →
                  </span>
                </Link>
              )}
            </div>

            {lastLoggedWorkout ? (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Your last run
                  </p>
                  <p className="text-sm text-gray-900 mt-1 leading-snug">
                    <span className="font-semibold">{lastLoggedWorkout.title}</span>
                    {lastRunDayLabelHome ? (
                      <>
                        {' '}
                        · {lastRunDayLabelHome}
                      </>
                    ) : null}
                    {lastLoggedWorkout.actualDistanceMeters != null &&
                    lastLoggedWorkout.actualDistanceMeters > 0 ? (
                      <>
                        {' '}
                        · {metersToMiDisplay(lastLoggedWorkout.actualDistanceMeters)}
                      </>
                    ) : null}
                    {lastLoggedWorkout.actualAvgPaceSecPerMile != null ? (
                      <>
                        {' '}
                        · {formatSecPerMile(lastLoggedWorkout.actualAvgPaceSecPerMile)}
                      </>
                    ) : null}
                    {lastRunDurationHome ? (
                      <>
                        {' '}
                        · {lastRunDurationHome}
                      </>
                    ) : null}
                  </p>
                  {lastRunBeatLineHome ? (
                    <p className="text-sm text-gray-700 mt-1">{lastRunBeatLineHome}</p>
                  ) : null}
                </div>
                <Link
                  href={`/workouts/${lastLoggedWorkout.id}`}
                  className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  View results →
                </Link>
              </div>
            ) : lastFallbackActivity ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Latest synced activity
                  </p>
                  <p className="text-sm text-gray-900 mt-1 leading-snug">
                    <span className="font-semibold">
                      {lastFallbackActivity.activityName || 'Run'}
                    </span>
                    {lastFallbackActivity.activityType ? (
                      <span className="text-gray-600"> · {lastFallbackActivity.activityType}</span>
                    ) : null}
                    {lastFallbackActivity.startTime ? (
                      <>
                        {' '}
                        ·{' '}
                        {new Date(lastFallbackActivity.startTime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    ) : null}
                    {lastFallbackActivity.distance != null && lastFallbackActivity.distance > 0 ? (
                      <> · {metersToMiDisplay(lastFallbackActivity.distance)}</>
                    ) : null}
                  </p>
                  <p className="text-xs text-amber-900 mt-2">
                    Not linked to a plan workout yet — open to match or review.
                  </p>
                </div>
                <Link
                  href={`/activities/${lastFallbackActivity.id}`}
                  className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  View activity →
                </Link>
              </div>
            ) : null}

            {paceNotifications.length > 0 && paceNotifications[0]?.summaryMessage ? (
              <div
                className={`mb-4 rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm ${
                  paceNotifications[0].adjustmentSecPerMile > 0
                    ? 'border-emerald-200 bg-emerald-50/90'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <p className="text-gray-800 min-w-0">
                  <span className="font-medium">
                    {paceNotifications[0].adjustmentSecPerMile > 0
                      ? '5K pace updated · '
                      : 'Weekly review · '}
                  </span>
                  <span className="text-gray-700">{paceNotifications[0].summaryMessage}</span>
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const athleteId = LocalStorageAPI.getAthleteId();
                    const top = paceNotifications[0];
                    if (!athleteId || !top) return;
                    try {
                      await api.patch(`/athlete/${athleteId}/pace-notifications`, { logId: top.id });
                      setPaceNotifications((prev) => prev.filter((n) => n.id !== top.id));
                    } catch (e) {
                      console.error('dismiss pace notification', e);
                    }
                  }}
                  className="shrink-0 text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {!garminConnected && (
              <div className="rounded-xl border border-orange-200 bg-white p-4 flex flex-wrap items-center gap-4">
                <Image
                  src="/Garmin_Connect_app_1024x1024-02.png"
                  alt="Garmin Connect"
                  width={40}
                  height={40}
                  className="rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-[200px]">
                  <h3 className="text-sm font-semibold text-gray-900">Connect Garmin</h3>
                  <p className="text-sm text-gray-600">Push workouts to your watch and sync runs.</p>
                </div>
                <button
                  onClick={handleConnectGarmin}
                  disabled={connectingGarmin}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap"
                >
                  {connectingGarmin ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
