'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gofastbackendv2-fall2025.onrender.com/api';

export default function AthleteHomePage() {
  const router = useRouter();

  // Use hooks to get all hydrated data from localStorage
  const { athlete: athleteProfile, athleteId, runCrewId, runCrewManagerId, runCrew } =
    useHydratedAthlete();

  // Fetch activities (with automatic refresh from backend if localStorage is empty)
  const { activities: weeklyActivities, weeklyTotals, isLoading: activitiesLoading } =
    useActivities(athleteId);

  // Check if user is an admin of the current crew
  const isCrewAdmin = useMemo(() => {
    return Boolean(runCrewManagerId);
  }, [runCrewManagerId]);

  const [crew, setCrew] = useState(runCrew);
  const [garminConnected, setGarminConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isHydratingCrew, setIsHydratingCrew] = useState(false);

  // Hydrate crew if we have runCrewId but no crew data
  useEffect(() => {
    const hydrateCrew = async () => {
      if (runCrewId && athleteId && !crew && !isHydratingCrew) {
        setIsHydratingCrew(true);
        try {
          const { data } = await api.post('/runcrew/hydrate', { runCrewId, athleteId });
          if (data?.success && data.runCrew) {
            LocalStorageAPI.setRunCrewData(data.runCrew);
            setCrew(data.runCrew);
          }
        } catch (error) {
          console.error('Failed to hydrate crew:', error);
        } finally {
          setIsHydratingCrew(false);
        }
      } else if (runCrew) {
        setCrew(runCrew);
      }
    };
    hydrateCrew();
  }, [runCrewId, athleteId, runCrew, isHydratingCrew]);

  // Check Garmin connection status
  useEffect(() => {
    const checkGarminConnection = async () => {
      if (!athleteId) {
        setCheckingConnection(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/garmin/status?athleteId=${athleteId}`);
        if (response.ok) {
          const data = await response.json();
          setGarminConnected(data.connected || false);
        }
      } catch (error) {
        console.error('Error checking Garmin connection:', error);
      } finally {
        setCheckingConnection(false);
      }
    };

    checkGarminConnection();
  }, [athleteId]);

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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
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
        {garminConnected && weeklyTotals && <WeeklyStats weeklyTotals={weeklyTotals} />}

        {/* Garmin Connection Prompt */}
        {!checkingConnection && !garminConnected && (
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
