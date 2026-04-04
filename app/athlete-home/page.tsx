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
} from '@/lib/workout-generator/pace-calculator';

function homeSessionPaceLabel(segments: { stepOrder: number; targets: unknown }[] | undefined): string | null {
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
    if (low != null && typeof low === 'number' && high != null && typeof high === 'number') {
      return formatPaceTargetRangeForDisplay(low, high);
    }
    if (low != null && typeof low === 'number') {
      return formatPaceTargetSingleForDisplay(low);
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

export default function AthleteHomePage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [garminConnected, setGarminConnected] = useState(false);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryGoal, setPrimaryGoal] = useState<any>(null);

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

    const [goalsRes, upcomingRes] = await Promise.allSettled([
      api.get('/goals?status=ACTIVE'),
      api.get('/training/upcoming'),
    ]);

    if (goalsRes.status === 'fulfilled') {
      const goals = goalsRes.value.data?.goals ?? [];
      setPrimaryGoal(goals[0] ?? null);
    } else {
      console.warn('athlete-home: goals fetch failed', goalsRes.reason);
    }

    if (upcomingRes.status === 'fulfilled') {
      setUpcomingSessions(upcomingRes.value.data?.sessions ?? []);
    } else {
      console.warn('athlete-home: upcoming training fetch failed', upcomingRes.reason);
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

  const nextRun = upcomingSessions[0] ?? null;
  const nextRunHref =
    nextRun?.workoutId && String(nextRun.workoutId).length > 0
      ? `/workouts/${nextRun.workoutId}`
      : '/training';
  const nextRunDay =
    nextRun?.date != null
      ? new Date(nextRun.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;
  const nextRunPace = nextRun ? homeSessionPaceLabel(nextRun.segments) : null;

  const raceName = primaryGoal?.race_registry?.name ?? null;
  const raceDateStr =
    primaryGoal?.targetByDate != null
      ? new Date(primaryGoal.targetByDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const cardBase =
    'block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-200 hover:shadow-md transition-all h-full';

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {nextRun ? (
                <Link href={nextRunHref} className={cardBase}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Next run</h2>
                  <p className="text-lg font-semibold text-gray-900 leading-snug">{nextRun.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {nextRunDay ?? 'Date TBD'}
                    {nextRun.workoutType ? (
                      <>
                        {' '}
                        · <span className="capitalize">{String(nextRun.workoutType).toLowerCase()}</span>
                      </>
                    ) : null}
                  </p>
                  {nextRunPace ? (
                    <p className="text-sm text-gray-700 mt-2">
                      Target <span className="font-medium">{nextRunPace}</span>
                    </p>
                  ) : null}
                  <span className="text-sm font-semibold text-orange-600 mt-4 inline-block">Open workout →</span>
                </Link>
              ) : (
                <div className={`${cardBase} cursor-default hover:border-gray-200 hover:shadow-sm`}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Next run</h2>
                  <p className="text-gray-700">No run scheduled ahead.</p>
                  <Link href="/training" className="text-sm font-semibold text-orange-600 mt-4 inline-block hover:underline">
                    Go to training →
                  </Link>
                </div>
              )}

              {primaryGoal && (raceName || raceDateStr || goalDaysLeft != null) ? (
                <Link href="/goals" className={cardBase}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Next race</h2>
                  <p className="text-lg font-semibold text-gray-900 leading-snug">
                    {raceName ?? 'Your goal race'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {raceDateStr ?? 'Set race date in Goals'}
                    {goalDaysLeft != null ? ` · ${goalDaysLeft} days out` : null}
                  </p>
                  <span className="text-sm font-semibold text-orange-600 mt-4 inline-block">View goals →</span>
                </Link>
              ) : (
                <div className={`${cardBase} cursor-default hover:border-gray-200 hover:shadow-sm`}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Next race</h2>
                  <p className="text-gray-700">Add a race to your active goal.</p>
                  <Link href="/goals" className="text-sm font-semibold text-orange-600 mt-4 inline-block hover:underline">
                    Set a race goal →
                  </Link>
                </div>
              )}

              {primaryGoal ? (
                <Link href="/goals" className={cardBase}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Goal</h2>
                  <p className="text-lg font-semibold text-gray-900 leading-snug">
                    {primaryGoal.distance}
                    {primaryGoal.goalTime ? ` · ${primaryGoal.goalTime}` : ''}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Race pace <span className="font-medium text-gray-900">{formatSecPerMile(primaryGoal.goalRacePace)}</span>
                  </p>
                  {goalDaysLeft != null ? (
                    <p className="text-sm text-gray-500 mt-1">{goalDaysLeft} days to target</p>
                  ) : null}
                  <span className="text-sm font-semibold text-orange-600 mt-4 inline-block">Edit goal →</span>
                </Link>
              ) : (
                <div className={`${cardBase} cursor-default hover:border-gray-200 hover:shadow-sm`}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Goal</h2>
                  <p className="text-gray-700">Pick a race and target time to align workouts.</p>
                  <Link href="/goals" className="text-sm font-semibold text-orange-600 mt-4 inline-block hover:underline">
                    Set goal →
                  </Link>
                </div>
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
