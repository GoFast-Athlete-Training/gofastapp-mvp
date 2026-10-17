'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/shared/TopNav';
import CityRunRsvpGroup from '@/components/runs/CityRunRsvpGroup';
import { useCityRunPageLoad } from '@/components/runs/useCityRunPageLoad';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import { runRsvpPath } from '@/lib/city-run/run-nav-paths';
import { LocalStorageAPI } from '@/lib/localstorage';
import { auth } from '@/lib/firebase';

export default function CityRunTogetherPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const { run, loading, error, isGuestSession, fetchAll } = useCityRunPageLoad(runId);

  useEffect(() => {
    if (loading || !run) return;
    if (isGuestSession || !auth.currentUser) {
      router.replace(runRsvpPath(run.slug?.trim() || run.id));
      return;
    }
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteHasCityRunMembership(run, athleteId)) {
      router.replace(runRsvpPath(run.slug?.trim() || run.id));
    }
  }, [loading, run, isGuestSession, router]);

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
  if (isGuestSession || !athleteHasCityRunMembership(run, athleteId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <CityRunRsvpGroup run={run} onLeave={() => void fetchAll(false)} />
    </>
  );
}
