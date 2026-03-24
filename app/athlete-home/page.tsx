'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import WeeklyStats from '@/components/athlete/WeeklyStats';
import LatestActivityCard from '@/components/athlete/LatestActivityCard';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import UpcomingRuns from '@/components/athlete/UpcomingRuns';
import PerformanceSnapshot from '@/components/athlete/PerformanceSnapshot';
import QuickActions from '@/components/athlete/QuickActions';
import Image from 'next/image';
import api from '@/lib/api';
import Link from 'next/link';

function computeWeeklyTotalsFromActivities(activityList: any[]) {
  const METERS_PER_MILE = 1609.34;
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 7);

  const thisWeekActivities = activityList.filter((a) => {
    const t = a.startTime ? new Date(a.startTime) : null;
    return t && t >= startOfThisWeek && t < endOfThisWeek;
  });
  const totalDistanceMeters = thisWeekActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0);
  const totalDurationSeconds = thisWeekActivities.reduce((sum, a) => sum + (a.duration ?? 0), 0);
  return {
    distance: totalDistanceMeters,
    duration: totalDurationSeconds,
    activities: thisWeekActivities.length,
    totalDistance: totalDistanceMeters,
    totalDistanceMiles: (totalDistanceMeters / METERS_PER_MILE).toFixed(2),
    totalDuration: totalDurationSeconds,
    totalCalories: 0,
    activityCount: thisWeekActivities.length,
  };
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
  const [weeklyActivities, setWeeklyActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [workoutsList, setWorkoutsList] = useState<any[]>([]);
  const [garminConnected, setGarminConnected] = useState(false);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryGoal, setPrimaryGoal] = useState<any>(null);

  const loadHome = useCallback(async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      // No identity at all — welcome needs to resolve it
      router.replace('/welcome');
      return;
    }

    setLoading(true);

    // ── Identity fetch (must succeed) ──────────────────────────────────────
    let row: any = null;
    try {
      const profileRes = await api.get(`/athlete/${athleteId}`);
      row = profileRes.data?.athlete;
      if (!row) {
        // Profile missing — identity is invalid, must re-resolve
        router.replace('/welcome');
        return;
      }
      setAthlete(row);
    } catch (profileErr: any) {
      const status = profileErr?.response?.status;
      if (status === 404 || status === 401) {
        // Identity failure — go back to welcome to re-resolve
        router.replace('/welcome');
        return;
      }
      // Network hiccup on the profile itself — show error state, don't loop
      console.error('athlete-home: profile fetch failed', profileErr);
      setLoading(false);
      return;
    }

    // ── Secondary data fetches (can fail softly) ───────────────────────────
    // Failures here show empty states in UI. Welcome is never involved.
    const [actRes, goalsRes, workoutsRes] = await Promise.allSettled([
      api.get('/activities?limit=50'),
      api.get('/goals?status=ACTIVE'),
      api.get('/workouts'),
    ]);

    if (actRes.status === 'fulfilled') {
      const activities = actRes.value.data?.activities ?? [];
      setWeeklyActivities(activities);
      setWeeklyTotals(computeWeeklyTotalsFromActivities(activities));
    } else {
      console.warn('athlete-home: activities fetch failed', actRes.reason);
    }

    if (goalsRes.status === 'fulfilled') {
      const goals = goalsRes.value.data?.goals ?? [];
      setPrimaryGoal(goals[0] ?? null);
    } else {
      console.warn('athlete-home: goals fetch failed', goalsRes.reason);
    }

    if (workoutsRes.status === 'fulfilled') {
      setWorkoutsList(workoutsRes.value.data?.workouts ?? []);
    } else {
      console.warn('athlete-home: workouts fetch failed', workoutsRes.reason);
    }

    const garminFromStorage =
      typeof window !== 'undefined' && localStorage.getItem('garminConnected') === 'true';
    // Tokens stripped from API; infer test mode from flag only (tokens exist server-side).
    const testGarminReady = !!row.garmin_use_test_tokens;
    setGarminConnected(!!row.garmin_is_connected || testGarminReady || garminFromStorage);

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

  const upcomingWorkouts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const withDate = workoutsList.filter((w) => w.date != null);
    const upcoming = withDate
      .filter((w) => {
        const d = new Date(w.date);
        return !Number.isNaN(d.getTime()) && d >= start;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
    if (upcoming.length >= 3) return upcoming;
    const rest = withDate
      .filter((w) => new Date(w.date) < start && !w.matchedActivityId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 2);
    return [...upcoming, ...rest].slice(0, 5);
  }, [workoutsList]);

  const latestActivity = useMemo(() => {
    if (!weeklyActivities?.length) return null;
    return weeklyActivities[0];
  }, [weeklyActivities]);

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
        throw new Error(errorData.error || 'Failed to get auth URL');
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
          window.location.reload();
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
          window.location.reload();
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {athlete.firstName}!</h1>
              <p className="text-gray-600">Here&apos;s your training overview</p>
            </div>

            <UpcomingRuns workouts={upcomingWorkouts} />

            <PerformanceSnapshot
              fiveKPace={athlete.fiveKPace}
              goalRacePaceSecPerMile={primaryGoal?.goalRacePace ?? null}
            />

            <QuickActions />

            {primaryGoal ? (
              <div className="mb-8 bg-white rounded-xl shadow-md border border-orange-100 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Active goal</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {primaryGoal.distance}
                      {primaryGoal.goalTime ? ` · ${primaryGoal.goalTime}` : ' · completion'}
                    </p>
                    {primaryGoal.race_registry?.name && (
                      <p className="text-sm text-gray-600 mt-2">{primaryGoal.race_registry.name}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-600">
                      Race pace{' '}
                      <span className="font-semibold text-gray-900">{formatSecPerMile(primaryGoal.goalRacePace)}</span>
                    </p>
                    {goalDaysLeft != null && <p className="text-gray-500 mt-1">{goalDaysLeft} days to target</p>}
                    <Link
                      href="/goals"
                      className="text-orange-600 font-medium mt-2 inline-block hover:underline"
                    >
                      Edit goal
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 bg-white rounded-xl shadow-md border border-dashed border-orange-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900">Set a race goal</h2>
                <p className="text-sm text-gray-600 mt-2 max-w-xl">
                  Train for a goal — pick a race and target time to align workouts and pacing.
                </p>
                <Link
                  href="/goals"
                  className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Set goal
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {garminConnected && weeklyTotals && (
                <WeeklyStats weeklyTotals={weeklyTotals} activities={weeklyActivities} />
              )}
              {latestActivity && <LatestActivityCard latestActivity={latestActivity} />}
            </div>

            {!garminConnected && (
              <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200 mb-8">
                <div className="flex items-center gap-4">
                  <Image
                    src="/Garmin_Connect_app_1024x1024-02.png"
                    alt="Garmin Connect"
                    width={48}
                    height={48}
                    className="rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Connect Garmin</h3>
                    <p className="text-gray-600">
                      Push workouts to your watch and sync completed runs automatically.
                    </p>
                  </div>
                  <button
                    onClick={handleConnectGarmin}
                    disabled={connectingGarmin}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {connectingGarmin ? 'Connecting...' : 'Connect →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
