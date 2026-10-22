'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import TopNav from '@/components/shared/TopNav';
import CityRunRsvpGroup from '@/components/runs/CityRunRsvpGroup';
import CityRunRsvpSuccessScreen from '@/components/runs/CityRunRsvpSuccessScreen';
import { useCityRunPageLoad } from '@/components/runs/useCityRunPageLoad';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { cityRunTogetherPath } from '@/lib/city-run/run-nav-paths';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import { LocalStorageAPI } from '@/lib/localstorage';

function RunRsvpPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = params.runId as string;
  const showSuccess = searchParams.get('rsvp') === 'success';
  const { run, loading, error, isGuestSession, fetchAll } = useCityRunPageLoad(runId);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const clearSuccessQuery = () => {
    router.replace(cityRunTogetherPath(run?.slug?.trim() || run?.id || runId));
  };

  const handleJoinRun = async () => {
    if (!run) return;
    if (isGuestSession || !auth.currentUser) {
      router.push(`/join/run/${encodeURIComponent(run.slug ?? run.id)}/signup`);
      return;
    }
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status: 'going' });
      await fetchAll(false);
      router.replace(
        `${cityRunTogetherPath(run.slug?.trim() || run.id)}?rsvp=success`,
      );
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

  const athleteId = LocalStorageAPI.getAthleteId();
  if (
    showSuccess &&
    !isGuestSession &&
    athleteHasCityRunMembership(run, athleteId)
  ) {
    return (
      <>
        <TopNav />
        <CityRunRsvpSuccessScreen run={run} onContinue={clearSuccessQuery} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav />
      <CityRunRsvpGroup
        run={run}
        onLeave={() => void fetchAll(false)}
        isGuestSession={isGuestSession}
        onJoinRun={() => void handleJoinRun()}
        rsvpLoading={rsvpLoading}
        backHref="/gorun"
        backLabel="Run"
      />
    </div>
  );
}

export default function RunRsvpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <RunRsvpPageContent />
    </Suspense>
  );
}
