'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';
import useActivities from '@/hooks/useActivities';
import api from '@/lib/api';
import { Activity } from 'lucide-react';
import AthleteHeader from '@/components/athlete/AthleteHeader';
import ProfileCallout from '@/components/athlete/ProfileCallout';
import CrewHero from '@/components/athlete/CrewHero';
import WeeklyStats from '@/components/athlete/WeeklyStats';
import LatestActivityCard from '@/components/athlete/LatestActivityCard';
import RSVPCard from '@/components/athlete/RSVPCard';

export default function AthleteHomePage() {
  const router = useRouter();

  // Use hooks to get all hydrated data from localStorage
  const { athlete: athleteProfile, athleteId, runCrewId, runCrewManagerId, runCrew } =
    useHydratedAthlete();

  // Fetch activities from localStorage only (local-first)
  const { activities: weeklyActivities, weeklyTotals, isLoading: activitiesLoading, error: activitiesError } =
    useActivities(athleteId);

  // Check if user is an admin of the current crew
  const isCrewAdmin = useMemo(() => {
    return Boolean(runCrewManagerId);
  }, [runCrewManagerId]);

  const [crew, setCrew] = useState(runCrew);
  const [garminConnected, setGarminConnected] = useState(() => {
    // LOCAL-FIRST: Load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('garminConnected');
      return stored === 'true';
    }
    return false;
  });
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [isHydratingCrew, setIsHydratingCrew] = useState(false);

  // NO REDIRECT - Users stay on athlete-home to see activities
  // Removed RunCrew or Bust redirect - let users see their activities!
  // Log only once on mount and when key values change (not arrays/objects that recreate)
  useEffect(() => {
    console.log('🏠 ATHLETE HOME: Page loaded, staying on athlete-home');
    console.log('🏠 ATHLETE HOME: athleteProfile:', !!athleteProfile);
    console.log('🏠 ATHLETE HOME: runCrewId:', runCrewId);
    console.log('🏠 ATHLETE HOME: weeklyActivities count:', weeklyActivities?.length || 0);
    console.log('🏠 ATHLETE HOME: weeklyTotals:', weeklyTotals);
    console.log('🏠 ATHLETE HOME: garminConnected:', garminConnected);
    // Only depend on primitive values to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteProfile, runCrewId, garminConnected]);

  // Hydrate crew if we have runCrewId but no crew data (local-first: only fetch if missing)
  useEffect(() => {
    const hydrateCrew = async () => {
      if (runCrewId && athleteId && !crew && !isHydratingCrew) {
        setIsHydratingCrew(true);
        try {
          const { data } = await api.post('/runcrew/hydrate', { runCrewId, athleteId });
          if (data?.success && data.runCrew) {
            LocalStorageAPI.setRunCrewData(data.runCrew);
            setCrew(data.runCrew);
          } else {
            // No fallback - redirect on error
            console.error('❌ ATHLETE HOME: Crew hydration failed, redirecting');
            router.push('/athlete-welcome');
          }
        } catch (error: any) {
          console.error('❌ ATHLETE HOME: Failed to hydrate crew:', error);
          // No fallback - redirect on error
          router.push('/athlete-welcome');
        } finally {
          setIsHydratingCrew(false);
        }
      } else if (runCrew) {
        setCrew(runCrew);
      }
    };
    hydrateCrew();
  }, [runCrewId, athleteId, runCrew, isHydratingCrew, router]);

  // LOCAL-FIRST: Garmin connection status is loaded from localStorage on mount
  // Only check API if explicitly needed (e.g., user clicks "Connect Garmin")
  // No automatic API calls on page load

  // Get next run from crew
  const nextRun = useMemo(() => {
    if (!crew?.runs || !Array.isArray(crew.runs)) return null;
    const upcomingRuns = crew.runs
      .filter((run: any) => {
        const runDate = run.date || run.scheduledAt;
        if (!runDate) return false;
        return new Date(runDate) >= new Date();
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.scheduledAt);
        const dateB = new Date(b.date || b.scheduledAt);
        return dateA.getTime() - dateB.getTime();
      });
    return upcomingRuns[0] || null;
  }, [crew]);

  // Get attendees for next run (first 3)
  const nextRunAttendees = useMemo(() => {
    if (!nextRun?.rsvps) return [];
    return nextRun.rsvps
      .filter((rsvp: any) => rsvp.status === 'going')
      .slice(0, 3)
      .map((rsvp: any) => rsvp.athlete || rsvp);
  }, [nextRun]);

  // Get latest activity
  const latestActivity = useMemo(() => {
    if (!weeklyActivities || weeklyActivities.length === 0) return null;
    return weeklyActivities[0]; // Already sorted by date desc
  }, [weeklyActivities]);

  // Profile setup logic
  const profileIncomplete =
    !athleteProfile?.firstName || !athleteProfile?.lastName || !athleteProfile?.primarySport;

  // Error handling: redirect to welcome/home on errors (no fallbacks)
  useEffect(() => {
    if (activitiesError) {
      console.error('❌ ATHLETE HOME: Activities error, redirecting to welcome:', activitiesError);
      router.push('/athlete-welcome');
    }
  }, [activitiesError, router]);

  // Render guard: redirect if no athlete data
  if (!athleteProfile) {
    router.push('/athlete-welcome');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AthleteHeader />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {profileIncomplete && <ProfileCallout athlete={athleteProfile} />}

        <CrewHero
          crew={crew}
          nextRun={nextRun}
          nextRunAttendees={nextRunAttendees}
          isCrewAdmin={isCrewAdmin}
          runCrewId={runCrewId}
        />

        {/* Weekly Stats - Only show if Garmin connected */}
        {garminConnected && weeklyTotals && (
          <WeeklyStats weeklyTotals={weeklyTotals} activities={weeklyActivities} />
        )}

        {/* Garmin Connection Prompt */}
        {!garminConnected && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
            <div className="flex items-center gap-4">
              <Activity className="h-12 w-12 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Connect Garmin to Track Activities
                </h3>
                <p className="text-sm text-gray-600">
                  Sync your runs automatically and see your stats on the leaderboard
                </p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition whitespace-nowrap"
              >
                Connect →
              </button>
            </div>
          </div>
        )}

        {/* Latest Activity Card */}
        {latestActivity && <LatestActivityCard latestActivity={latestActivity} />}

        {/* RSVP CTA - Only if crew has upcoming run */}
        {crew && nextRun && (
          <RSVPCard
            nextRun={nextRun}
            crew={crew}
            runCrewId={runCrewId}
            isCrewAdmin={isCrewAdmin}
          />
        )}
      </main>
    </div>
  );
}
