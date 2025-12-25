'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';
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
  const { athlete: athleteProfile, runCrewId, runCrewManagerId, runCrew } =
    useHydratedAthlete();

  // Load activities from localStorage ONLY - no API calls, no useEffect
  const model = LocalStorageAPI.getFullHydrationModel();
  const weeklyActivities = model?.weeklyActivities || [];
  const weeklyTotals = model?.weeklyTotals || null;

  // Check if user is an admin of the current crew
  const isCrewAdmin = Boolean(runCrewManagerId);

  // Use crew from localStorage
  const crew = runCrew;

  // Load Garmin connection status from localStorage
  const garminConnected = typeof window !== 'undefined' 
    ? localStorage.getItem('garminConnected') === 'true'
    : false;

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
