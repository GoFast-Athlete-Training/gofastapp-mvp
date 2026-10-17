'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/shared/TopNav';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunDetailsSection, {
  CityRunRsvpPanel,
  CityRunSeriesPanel,
} from '@/components/runs/CityRunDetailsSection';
import CityRunWorkoutCard from '@/components/runs/CityRunWorkoutCard';
import { PublicSeeWhosGoingSection } from '@/components/runs/CityRunPeopleSection';
import { useCityRunPageLoad } from '@/components/runs/useCityRunPageLoad';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import {
  runShouldShowWorkoutPrescribe,
  type CityRunDetails,
} from '@/components/runs/city-run-types';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import { cityRunTogetherPath } from '@/lib/city-run/run-nav-paths';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function RunRsvpPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const { run, loading, error, isGuestSession, fetchAll } = useCityRunPageLoad(runId);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const joinRunPath = (r: CityRunDetails) =>
    `/join/run/${encodeURIComponent(r.slug ?? r.id)}`;

  const [athleteId, setAthleteId] = useState<string | null>(null);
  useEffect(() => {
    setAthleteId(LocalStorageAPI.getAthleteId());
  }, [run?.currentRSVPRole, run?.id]);

  const alreadyRsvped = run ? athleteHasCityRunMembership(run, athleteId) : false;
  const hubHref = run
    ? cityRunTogetherPath(run.slug?.trim() || run.id)
    : null;

  const handleRsvp = async () => {
    if (!run) return;
    if (isGuestSession || !auth.currentUser) {
      router.push(joinRunPath(run));
      return;
    }
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status: 'going' });
      await fetchAll(false);
      router.push(cityRunTogetherPath(run.slug?.trim() || run.id));
    } catch (err) {
      console.error('RSVP error:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Run not found'}</h1>
          <button
            type="button"
            onClick={() => router.push('/gorun')}
            className="text-orange-500 hover:text-orange-600 font-semibold"
          >
            ← Back to Run
          </button>
        </div>
      </div>
    );
  }

  const isSeries = run.runSeriesId != null;
  const hasWorkout = runShouldShowWorkoutPrescribe(run);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav />
      <div className="mx-auto px-4 py-4 sm:py-6 max-w-5xl">
        <CityRunMobileTabs
          mode="pre-rsvp"
          run={run}
          runIsPast={false}
          rsvpLoading={rsvpLoading}
          onRsvp={() => void handleRsvp()}
          onCheckin={() => undefined}
          onBack={() => router.push('/discoverruns')}
          allowCheckin={false}
          publicRsvpPage
          alreadyRsvped={alreadyRsvped}
          hubHref={hubHref}
        />

        <div className="hidden lg:grid grid-cols-3 gap-6">
          <div className={`space-y-4 ${isSeries ? 'col-span-2' : 'col-span-2 order-2 lg:order-1'}`}>
            <CityRunDetailsSection
              run={run}
              showBackButton
              onBack={() => router.push('/discoverruns')}
              showHostCard
            />
            {hasWorkout ? (
              <CityRunWorkoutCard
                workoutId={run.workoutId}
                workout={run.workout}
                workoutDescription={run.workoutDescription}
              />
            ) : null}
          </div>

          <div className={`space-y-4 ${isSeries ? '' : 'order-1 lg:order-2'}`}>
            {isSeries && run.runSeries ? (
              <CityRunSeriesPanel
                series={run.runSeries}
                runClub={run.runClub}
                occurrenceMeetUpPoint={run.meetUpPoint}
                occurrenceStartTimeHour={run.startTimeHour}
                occurrenceStartTimeMinute={run.startTimeMinute}
                occurrenceStartTimePeriod={run.startTimePeriod}
              />
            ) : null}
            <PublicSeeWhosGoingSection rsvps={run.rsvps || []} />
            <CityRunRsvpPanel
              runIsPast={false}
              rsvpLoading={rsvpLoading}
              onRsvp={() => void handleRsvp()}
              onCheckin={() => undefined}
              runClub={run.runClub}
              cityRunType={run.cityRunType}
              runTitle={run.title}
              allowCheckin={false}
              publicRsvpPage
              alreadyRsvped={alreadyRsvped}
              hubHref={hubHref}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
