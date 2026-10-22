'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/shared/TopNav';
import CityRunTogetherMemberHub from '@/components/runs/CityRunTogetherMemberHub';
import { useCityRunPageLoad } from '@/components/runs/useCityRunPageLoad';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import {
  cityRunJoinPath,
  consumeCityRunJoinedBanner,
} from '@/lib/city-run/run-nav-paths';
import { LocalStorageAPI } from '@/lib/localstorage';
import { auth } from '@/lib/firebase';

function CityRunTogetherPageContent() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const { run, loading, error, fetchAll } = useCityRunPageLoad(runId, {
    memberOnly: true,
  });
  const [showJoinedBanner, setShowJoinedBanner] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);

  useEffect(() => {
    if (!run || loading) return;
    if (!auth.currentUser) return;

    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteHasCityRunMembership(run, athleteId)) {
      router.replace(cityRunJoinPath(run.slug?.trim() || run.id));
      return;
    }
    setShowJoinedBanner(consumeCityRunJoinedBanner(run.id));
    setMembershipChecked(true);
  }, [run, loading, router]);

  if (loading || (run && !membershipChecked && auth.currentUser)) {
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

  if (!membershipChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav />
      <CityRunTogetherMemberHub
        run={run}
        onLeave={() => void fetchAll(false)}
        showJoinedBanner={showJoinedBanner}
        backHref="/gorun"
        backLabel="Run"
      />
    </div>
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
