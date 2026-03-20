'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CrewHero from '@/components/athlete/CrewHero';
import WeeklyStats from '@/components/athlete/WeeklyStats';
import LatestActivityCard from '@/components/athlete/LatestActivityCard';
import { Home, Users, Activity, Dumbbell, User, Trophy, MapPin } from 'lucide-react';
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
  const [runCrewId, setRunCrewId] = useState<string | null>(null);
  const [runCrew, setRunCrew] = useState<any>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [garminConnected, setGarminConnected] = useState(false);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryGoal, setPrimaryGoal] = useState<any>(null);
  const [membershipsForCrewNav, setMembershipsForCrewNav] = useState<
    { role: string; runCrew: { id: string; name?: string; icon?: string } }[]
  >([]);

  const loadHome = useCallback(async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.replace('/welcome');
      return;
    }

    setLoading(true);
    try {
      const [profileRes, memRes, actRes, goalsRes] = await Promise.all([
        api.get(`/athlete/${athleteId}`),
        api.get('/me/memberships'),
        api.get('/activities?limit=50'),
        api.get('/goals?status=ACTIVE'),
      ]);

      const row = profileRes.data?.athlete;
      if (!row) {
        router.replace('/welcome');
        return;
      }

      const memberships = memRes.data?.memberships ?? [];
      const primaryCrewId: string | null = memRes.data?.primaryCrewId ?? null;

      const runCrewMemberships = memberships.map((m: any) => ({
        runCrew: m.runCrew,
        role: m.role,
      }));

      setMembershipsForCrewNav(
        memberships.map((m: any) => ({
          role: m.role,
          runCrew: {
            id: m.runCrew.id,
            name: m.runCrew.name,
            icon: m.runCrew.icon,
          },
        }))
      );

      setAthlete({ ...row, runCrewMemberships });
      setRunCrewId(primaryCrewId);

      const primaryMembership = primaryCrewId
        ? memberships.find((m: any) => m.runCrewId === primaryCrewId)
        : null;
      setRunCrew(primaryMembership?.runCrew ?? null);

      const activities = actRes.data?.activities ?? [];
      setWeeklyActivities(activities);
      setWeeklyTotals(computeWeeklyTotalsFromActivities(activities));

      const goals = goalsRes.data?.goals ?? [];
      setPrimaryGoal(goals[0] ?? null);

      const garminFromStorage = typeof window !== 'undefined' && localStorage.getItem('garminConnected') === 'true';
      setGarminConnected(!!row.garmin_is_connected || garminFromStorage);
    } catch (e) {
      console.error('athlete-home load failed', e);
      router.replace('/welcome');
    } finally {
      setLoading(false);
    }
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

  const nextRun = useMemo(() => {
    if (!runCrew?.runs) return null;
    const now = new Date();
    const upcoming = runCrew.runs
      .filter((run: any) => {
        if (!run.date) return false;
        return new Date(run.date) >= now;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  }, [runCrew]);

  const nextRunAttendees = useMemo(() => {
    if (!nextRun?.rsvps) return [];
    return nextRun.rsvps
      .filter((rsvp: any) => rsvp.status === 'going')
      .slice(0, 3)
      .map((rsvp: any) => rsvp.athlete);
  }, [nextRun]);

  const latestActivity = useMemo(() => {
    if (!weeklyActivities?.length) return null;
    return weeklyActivities[0];
  }, [weeklyActivities]);

  const isCrewAdmin = useMemo(() => {
    if (!athlete?.runCrewMemberships || !runCrewId) return false;
    const membership = athlete.runCrewMemberships.find((m: any) => m.runCrew?.id === runCrewId);
    return membership?.role === 'admin' || membership?.role === 'manager';
  }, [athlete, runCrewId]);

  const handleGoToCrew = () => {
    if (!runCrewId) {
      router.push('/runcrew-discovery');
      return;
    }
    if (isCrewAdmin) {
      router.push(`/runcrew/${runCrewId}/admin`);
    } else {
      router.push(`/runcrew/${runCrewId}`);
    }
  };

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
        <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Image src="/logo.jpg" alt="GoFast" width={32} height={32} className="w-8 h-8 rounded-full" />
              <span className="text-lg font-bold text-gray-900">GoFast</span>
            </div>
            <p className="text-xs font-medium text-gray-700">Athlete Home</p>
            <p className="text-xs text-gray-500 mt-0.5">Use the menu to find runs, crews, and races.</p>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            <button
              onClick={() => router.push('/athlete-home')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200"
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </button>
            <button
              onClick={() => router.push('/my-runcrews')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Users className="h-5 w-5" />
              <span>My RunCrews</span>
            </button>
            <button
              onClick={() => router.push('/runcrew-discovery')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Users className="h-5 w-5" />
              <span>Discover RunCrews</span>
            </button>
            <button
              onClick={() => router.push('/activities')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Activity className="h-5 w-5" />
              <span>Activities</span>
            </button>
            <button
              onClick={() => router.push('/workouts')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Dumbbell className="h-5 w-5" />
              <span>Workouts</span>
            </button>
            <button
              onClick={() => router.push('/race-events')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Trophy className="h-5 w-5" />
              <span>Race Events</span>
            </button>
            <button
              onClick={() => router.push('/gorun')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <MapPin className="h-5 w-5" />
              <span>GoRun</span>
            </button>
            <button
              onClick={() => router.push('/athlete-edit-profile')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {athlete.firstName}!</h1>
              <p className="text-gray-600">Here&apos;s what&apos;s happening with your RunCrews</p>
            </div>

            {primaryGoal && (
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
                      Race pace <span className="font-semibold text-gray-900">{formatSecPerMile(primaryGoal.goalRacePace)}</span>
                    </p>
                    {goalDaysLeft != null && (
                      <p className="text-gray-500 mt-1">{goalDaysLeft} days to target</p>
                    )}
                    <Link href="/settings/race-goal" className="text-orange-600 font-medium mt-2 inline-block hover:underline">
                      Edit goal
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-8">
              <CrewHero
                crew={runCrew}
                nextRun={nextRun}
                nextRunAttendees={nextRunAttendees}
                isCrewAdmin={isCrewAdmin}
                runCrewId={runCrewId}
                membershipsForNav={membershipsForCrewNav}
              />
            </div>

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
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Connect Garmin to Track Activities</h3>
                    <p className="text-gray-600">Sync your runs automatically and see your stats on the leaderboard</p>
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

            {runCrew && nextRun && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Your crew is running soon — RSVP now</h3>
                    <p className="text-gray-600">
                      {nextRun.title || 'Upcoming run'} on{' '}
                      {nextRun.date
                        ? new Date(nextRun.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Date TBD'}
                    </p>
                  </div>
                  <button
                    onClick={handleGoToCrew}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    RSVP →
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
