'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import CrewHero from '@/components/athlete/CrewHero';
import WeeklyStats from '@/components/athlete/WeeklyStats';
import LatestActivityCard from '@/components/athlete/LatestActivityCard';
import { 
  Home, 
  Users, 
  Activity, 
  Settings, 
  User, 
  Calendar,
  Trophy,
  LogOut,
  ExternalLink,
  MapPin
} from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/api';

export default function AthleteHomePage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [runCrewId, setRunCrewId] = useState<string | null>(null);
  const [runCrew, setRunCrew] = useState<any>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [garminConnected, setGarminConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upcomingRaces, setUpcomingRaces] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check auth
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace('/signup');
        return;
      }
    });

    // Load athlete data from localStorage
    const model = LocalStorageAPI.getFullHydrationModel();
    if (model?.athlete) {
      setAthlete(model.athlete);
      setRunCrewId(model.athlete.MyCrew || LocalStorageAPI.getMyCrew());
      setWeeklyActivities(model.weeklyActivities || []);
      setWeeklyTotals(model.weeklyTotals || null);
      
      // Get crew data
      const crewData = LocalStorageAPI.getRunCrewData();
      if (crewData) {
        setRunCrew(crewData);
      } else if (model.athlete.runCrewMemberships) {
        // Find primary crew from memberships
        const primaryCrewId = model.athlete.MyCrew || LocalStorageAPI.getMyCrew();
        const membership = model.athlete.runCrewMemberships.find(
          (m: any) => m.runCrew?.id === primaryCrewId
        );
        if (membership?.runCrew) {
          setRunCrew(membership.runCrew);
        }
      }

      // Check Garmin connection
      const garminStatus = localStorage.getItem('garminConnected');
      setGarminConnected(garminStatus === 'true');
    }

    // Load upcoming races
    loadUpcomingRaces();

    setLoading(false);
    return () => unsubscribe();
  }, [router]);

  const loadUpcomingRaces = async () => {
    try {
      const response = await api.get('/race-events');
      if (response.data?.success && response.data?.events) {
        // Show first 3 upcoming races
        setUpcomingRaces(response.data.events.slice(0, 3));
      }
    } catch (error) {
      console.log('Could not load upcoming races:', error);
      setUpcomingRaces([]);
    }
  };

  // Calculate next run
  const nextRun = useMemo(() => {
    if (!runCrew?.runs) return null;
    const now = new Date();
    const upcoming = runCrew.runs
      .filter((run: any) => {
        if (!run.date) return false;
        const runDate = new Date(run.date);
        return runDate >= now;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    return upcoming[0] || null;
  }, [runCrew]);

  // Calculate next run attendees
  const nextRunAttendees = useMemo(() => {
    if (!nextRun?.rsvps) return [];
    return nextRun.rsvps
      .filter((rsvp: any) => rsvp.status === 'going')
      .slice(0, 3)
      .map((rsvp: any) => rsvp.athlete);
  }, [nextRun]);

  // Calculate latest activity
  const latestActivity = useMemo(() => {
    if (!weeklyActivities || weeklyActivities.length === 0) return null;
    return weeklyActivities[0];
  }, [weeklyActivities]);

  // Check if user is crew admin
  const isCrewAdmin = useMemo(() => {
    if (!athlete?.runCrewMemberships || !runCrewId) return false;
    const membership = athlete.runCrewMemberships.find(
      (m: any) => m.runCrew?.id === runCrewId
    );
    return membership?.role === 'admin' || membership?.role === 'manager';
  }, [athlete, runCrewId]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      LocalStorageAPI.clearAll();
      router.replace('/signup');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
            onClick={() => router.push('/signup')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Navigation Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full"
            />
            <span className="text-lg font-bold text-gray-900">GoFast</span>
          </div>
          <p className="text-xs text-gray-500">Athlete Home</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* Home - Active */}
          <button
            onClick={() => router.push('/athlete-home')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200"
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>

          {/* My RunCrews */}
          <button
            onClick={() => router.push('/my-runcrews')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Users className="h-5 w-5" />
            <span>My RunCrews</span>
          </button>

          {/* Discover RunCrews */}
          <button
            onClick={() => router.push('/runcrew-discovery')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Users className="h-5 w-5" />
            <span>Discover RunCrews</span>
          </button>

          {/* Activities */}
          <button
            onClick={() => router.push('/activities')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Activity className="h-5 w-5" />
            <span>Activities</span>
          </button>

          {/* Race Events */}
          <button
            onClick={() => router.push('/race-events')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Trophy className="h-5 w-5" />
            <span>Race Events</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => router.push('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Bottom Section - Profile & Sign Out */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            {athlete.photoURL ? (
              <Image
                src={athlete.photoURL}
                alt={athlete.firstName || 'Profile'}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                {(athlete.firstName?.[0] || 'A').toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {athlete.firstName} {athlete.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">@{athlete.gofastHandle}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {athlete.firstName}!
            </h1>
            <p className="text-gray-600">Here's what's happening with your RunCrews</p>
          </div>

          {/* Crew Hero Section */}
          <div className="mb-8">
            <CrewHero
              crew={runCrew}
              nextRun={nextRun}
              nextRunAttendees={nextRunAttendees}
              isCrewAdmin={isCrewAdmin}
              runCrewId={runCrewId}
            />
          </div>

          {/* Stats and Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Weekly Stats */}
            {garminConnected && weeklyTotals && (
              <WeeklyStats weeklyTotals={weeklyTotals} activities={weeklyActivities} />
            )}

            {/* Latest Activity */}
            {latestActivity && <LatestActivityCard latestActivity={latestActivity} />}
          </div>

          {/* Garmin Connection Prompt */}
          {!garminConnected && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200 mb-8">
              <div className="flex items-center gap-4">
                <Activity className="h-12 w-12 text-orange-500" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Connect Garmin to Track Activities
                  </h3>
                  <p className="text-gray-600">
                    Sync your runs automatically and see your stats on the leaderboard
                  </p>
                </div>
                <button
                  onClick={() => router.push('/settings')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition"
                >
                  Connect →
                </button>
              </div>
            </div>
          )}

          {/* RSVP CTA */}
          {runCrew && nextRun && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Your crew is running soon — RSVP now
                  </h3>
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

          {/* Upcoming Races Section */}
          {upcomingRaces.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-orange-500" />
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming Races</h3>
                </div>
                <button
                  onClick={() => router.push('/race-events')}
                  className="text-sm text-orange-600 hover:text-orange-700 font-semibold"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-3">
                {upcomingRaces.map((race) => (
                  <div
                    key={race.id}
                    onClick={() => {
                      if (race.url) {
                        window.open(race.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="flex items-start justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{race.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                        {race.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(race.startDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                        {race.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {race.location}
                          </span>
                        )}
                        {race.miles && (
                          <span className="text-orange-600">{race.miles} miles</span>
                        )}
                      </div>
                    </div>
                    {race.url && (
                      <ExternalLink className="h-4 w-4 text-orange-600 ml-2 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
