'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import TopNav from '@/components/shared/TopNav';
import CityRunRsvpGroup from '@/components/runs/CityRunRsvpGroup';
import CityRunRsvpSuccessScreen from '@/components/runs/CityRunRsvpSuccessScreen';
import { useCityRunPageLoad } from '@/components/runs/useCityRunPageLoad';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import { cityRunTogetherPath, runRsvpPath } from '@/lib/city-run/run-nav-paths';
import { LocalStorageAPI } from '@/lib/localstorage';
import { auth } from '@/lib/firebase';

function CityRunTogetherPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = params.runId as string;
  const showSuccess = searchParams.get('rsvp') === 'success';
  const { run, loading, error, isGuestSession, fetchAll } = useCityRunPageLoad(runId);

  useEffect(() => {
    if (loading || !run) return;
    const athleteId = LocalStorageAPI.getAthleteId();
    const hasMembership = athleteHasCityRunMembership(run, athleteId);
    const guest = isGuestSession || !auth.currentUser;

    if (guest || !hasMembership) {
      const qs = showSuccess ? '?rsvp=success' : '';
      router.replace(`${runRsvpPath(run.slug?.trim() || run.id)}${qs}`);
    }
  }, [loading, run, isGuestSession, router, showSuccess]);

  const dismissSuccess = () => {
    if (!run) return;
    router.replace(cityRunTogetherPath(run.slug?.trim() || run.id));
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
  const hasMembership = athleteHasCityRunMembership(run, athleteId);

  if (isGuestSession || !hasMembership) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <>
        <TopNav />
        <CityRunRsvpSuccessScreen run={run} onContinue={dismissSuccess} />
      </>
    );
  }

  return (
    <>
      <TopNav />
      <CityRunRsvpGroup run={run} onLeave={() => void fetchAll(false)} backHref="/gorun" backLabel="Run" />
    </>
  );
}

export default function CityRunTogetherPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <CityRunTogetherPageContent />
    </Suspense>
  );
}
