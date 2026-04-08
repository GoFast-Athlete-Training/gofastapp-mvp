'use client';

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
} from '@/lib/workout-generator/pace-calculator';

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

    const [goalsRes, upcomingRes, paceRes, goingRes] = await Promise.allSettled([
      api.get('/goals?status=ACTIVE'),
      api.get('/training/upcoming'),
      api.get(`/athlete/${athleteId}/pace-notifications`),
      api.get('/me/my-going-runs'),
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
  const goalHeadline =
    goalDistanceNorm && primaryGoal?.goalTime
      ? `${goalDistanceNorm} · ${primaryGoal.goalTime}`
      : goalDistanceNorm || primaryGoal?.goalTime || null;

  const cardFindRun =
    'block rounded-xl border-2 border-sky-200 bg-sky-50/70 p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition-all h-full';
  const cardTraining =
    'block rounded-xl border-2 border-emerald-200 bg-emerald-50/80 p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all h-full';

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

            {paceNotifications.length > 0 && paceNotifications[0]?.summaryMessage ? (
              <div
                className={`mb-6 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
                  paceNotifications[0].adjustmentSecPerMile > 0
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {paceNotifications[0].adjustmentSecPerMile > 0
                      ? 'Your 5K pace was updated'
                      : 'Weekly training review'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">{paceNotifications[0].summaryMessage}</p>
                </div>
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
                  className="shrink-0 text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
              {showTrainingAtGlance ? (
                <div className={`${cardTraining} lg:col-span-3 cursor-default hover:border-emerald-200`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                    Training plan
                  </p>
                  {activePlanSummary?.name ? (
                    <h2 className="text-xl font-semibold text-gray-900 leading-snug">
                      {activePlanSummary.name}
                    </h2>
                  ) : (
                    <h2 className="text-xl font-semibold text-gray-900 leading-snug">Your training</h2>
                  )}
                  {raceName ? (
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium text-gray-900">{raceName}</span>
                      {raceDateStr ? (
                        <span className="text-gray-600">
                          {' '}
                          · {raceDateStr}
                          {goalDaysLeft != null ? ` · ${goalDaysLeft} days out` : ''}
                        </span>
                      ) : null}
                    </p>
                  ) : primaryGoal ? (
                    <p className="text-sm text-gray-600 mt-2">Set your race in Goals to lock the calendar.</p>
                  ) : null}
                  {goalHeadline ? (
                    <p className="text-base font-semibold text-gray-900 mt-3">{goalHeadline}</p>
                  ) : null}
                  {primaryGoal?.goalRacePace != null ? (
                    <p className="text-sm text-gray-600 mt-1">
                      Race pace{' '}
                      <span className="font-medium text-gray-900">
                        {formatSecPerMile(primaryGoal.goalRacePace)}
                      </span>
                    </p>
                  ) : null}
                  <div className="mt-4 pt-4 border-t border-emerald-200/80">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 mb-2">
                      Next training session
                    </p>
                    {nextTraining ? (
                      <>
                        <p className="text-lg font-semibold text-gray-900 leading-snug">
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
                          className="text-sm font-semibold text-emerald-800 mt-3 inline-block hover:underline"
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
                          My Training →
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-emerald-900">
                    <Link href="/training" className="hover:underline">
                      Calendar &amp; week view
                    </Link>
                    <Link href="/goals" className="hover:underline">
                      Goals
                    </Link>
                    <Link href="/workouts" className="hover:underline">
                      Go Train
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
                  <h2 className="text-xl font-semibold text-gray-900">Start your plan</h2>
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
                  <p className="text-lg font-semibold text-gray-900 leading-snug">{nextGoingRun.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {nextGoingDay ?? 'Date TBD'}
                    {nextGoingRun.city ? ` · ${nextGoingRun.city}` : ''}
                  </p>
                  <Link
                    href={`/gorun/${nextGoingRun.id}`}
                    className="text-sm font-semibold text-sky-800 mt-4 inline-block hover:underline"
                  >
                    Open meetup →
                  </Link>
                  <p className="text-xs text-sky-900/70 mt-4 pt-3 border-t border-sky-200/80">
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
                  <p className="text-gray-800 leading-relaxed">
                    RSVP to a community run and show up with a crew. No plan required.
                  </p>
                  <span className="text-sm font-semibold text-sky-800 mt-4 inline-block">
                    Browse runs →
                  </span>
                </Link>
              )}
            </div>

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
