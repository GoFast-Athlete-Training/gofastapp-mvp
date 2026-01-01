'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';
// PHASE 1: Activities temporarily disabled (MVP2)
// import { Activity } from 'lucide-react';
import AthleteHeader from '@/components/athlete/AthleteHeader';
import ProfileCallout from '@/components/athlete/ProfileCallout';
import CrewHero from '@/components/athlete/CrewHero';
// import WeeklyStats from '@/components/athlete/WeeklyStats';
// import LatestActivityCard from '@/components/athlete/LatestActivityCard';
// import RSVPCard from '@/components/athlete/RSVPCard';

export default function AthleteHomePage() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  // READ-ONLY: Use hook exclusively - NO direct localStorage reads, NO API calls
  // PHASE 1: Activities/Garmin deprecated - only using athlete profile and crew context
  const { 
    athlete: athleteProfile, 
    runCrewId, 
    runCrewManagerId,
    // weeklyActivities, // DEPRECATED: MVP2
    // weeklyTotals, // DEPRECATED: MVP2
    // garminConnected, // DEPRECATED: MVP2
    loading,
    hydrated
  } = useHydratedAthlete();

  // Redirect if not hydrated - use useEffect to prevent render-time redirects
  useEffect(() => {
    if (!loading && (!hydrated || !athleteProfile) && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/athlete-welcome');
    }
  }, [loading, hydrated, athleteProfile, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!hydrated || !athleteProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Check if user is an admin of the current crew
  const isCrewAdmin = Boolean(runCrewManagerId);

  // NOTE: Crew context is NOT hydrated on athlete-home
  // Crew data will hydrate when user navigates to /runcrew/* routes
  // For now, we only use runCrewId for navigation
  const crew = null; // Explicitly null - crew context not available here

  // NOTE: Crew context not available on athlete-home
  // These will be null until user navigates to crew routes
  const nextRun = null;
  const nextRunAttendees: any[] = [];

  // PHASE 1: Activities temporarily disabled (MVP2)
  // Get latest activity
  // const latestActivity = useMemo(() => {
  //   if (!weeklyActivities || weeklyActivities.length === 0) return null;
  //   return weeklyActivities[0]; // Already sorted by date desc
  // }, [weeklyActivities]);
  const latestActivity = null;

  // Profile setup logic
  const profileIncomplete =
    !athleteProfile?.firstName || !athleteProfile?.lastName || !athleteProfile?.primarySport;

  return (
    <div className="min-h-screen bg-gray-50">
      <AthleteHeader />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {profileIncomplete && <ProfileCallout athlete={athleteProfile} />}

        {/* CrewHero - crew context not available, will show empty state or join prompt */}
        <CrewHero
          crew={null}
          nextRun={null}
          nextRunAttendees={[]}
          isCrewAdmin={isCrewAdmin}
          runCrewId={runCrewId}
        />

        {/* PHASE 1: Activities/Garmin/Leaderboard temporarily disabled (MVP2) */}
        {/* Weekly Stats - Only show if Garmin connected */}
        {/* {garminConnected && weeklyTotals && (
          <WeeklyStats weeklyTotals={weeklyTotals} activities={weeklyActivities} />
        )} */}

        {/* Garmin Connection Prompt */}
        {/* {!garminConnected && (
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
        )} */}

        {/* Latest Activity Card */}
        {/* {latestActivity && <LatestActivityCard latestActivity={latestActivity} />} */}

        {/* RSVP CTA - Not available on athlete-home (crew context not hydrated) */}
      </main>
    </div>
  );
}
