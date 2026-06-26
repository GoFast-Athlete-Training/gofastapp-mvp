'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CityRunGoingContainer from '@/components/runs/CityRunGoingContainer';
import CityRunPostRunContainer from '@/components/runs/CityRunPostRunContainer';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunDetailsSection, {
  CityRunRsvpPanel,
  CityRunSeriesPanel,
} from '@/components/runs/CityRunDetailsSection';
import CityRunPeopleSection, { CityRunGoingSummary } from '@/components/runs/CityRunPeopleSection';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import {
  isRunPast,
  type CityRunCheckin,
  type CityRunDetails,
} from '@/components/runs/city-run-types';
import { hasSocialRunLifecycle, resolveRunRsvpCopy } from '@/lib/city-run-copy';

export default function GoRunPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [run, setRun] = useState<CityRunDetails | null>(null);
  const [checkins, setCheckins] = useState<CityRunCheckin[]>([]);
  const [myCheckin, setMyCheckin] = useState<CityRunCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (!runId) return;

    // Always wait for Firebase to resolve before fetching run. Otherwise we can
    // fire GET /api/runs/[runId] before auth has restored (e.g. athleteId in
    // localStorage but currentUser still null) and get 401.
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (user) {
        const athleteId = LocalStorageAPI.getAthleteId();
        if (!athleteId) {
          try {
            const token = await user.getIdToken();
            const res = await api.get('/athlete/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data?.success && res.data?.athleteId) {
              LocalStorageAPI.setAthleteId(res.data.athleteId);
            }
          } catch (e) {
            console.warn('gorun: /athlete/me failed, continuing as guest', e);
          }
        }
      }
      fetchAll();
    });
  }, [runId]);

  const fetchAll = async () => {
    try {
      setLoading(true);

      // Run fetch is the critical path — fail fast if this 404s or errors
      const runRes = await api.get(`/runs/${runId}`);
      if (!runRes.data.success || !runRes.data.run) {
        setError('Run not found');
        return;
      }
      const loaded = runRes.data.run as CityRunDetails;
      setRun(loaded);

      if (loaded.slug && runId && loaded.slug !== runId) {
        router.replace(`/gorun/${loaded.slug}`);
      }

      // Checkin fetch is secondary — a 401/500 here (e.g. missing migration on
      // preview DB, or unauthenticated guest) must NOT kill the run page
      try {
        const checkinRes = await api.get(`/runs/${runId}/checkin`);
        if (checkinRes.data.success) {
          const list = (checkinRes.data.checkins || []) as CityRunCheckin[];
          const my = (checkinRes.data.myCheckin ?? null) as CityRunCheckin | null;
          setCheckins(list);
          setMyCheckin(my);
        }
      } catch (checkinErr: any) {
        console.warn(
          'gorun: checkin fetch failed (status=%s) — showing run without checkin state',
          checkinErr?.response?.status,
          checkinErr?.response?.data,
        );
      }
    } catch (err: any) {
      console.error('gorun: run fetch failed', err?.response?.status, err?.response?.data, err?.message);
      if (err.response?.status === 404) setError('Run not found');
      else setError(`Failed to load run (${err?.response?.status ?? err?.message ?? 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (status: 'going' | 'not-going') => {
    if (!run) return;
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status });
      await fetchAll();
    } catch (err: any) {
      console.error('RSVP error:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!run) return;
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/checkin`, {});
      await fetchAll(); // re-fetch → myCheckin set → routes to CityRunPostRunContainer
    } catch (err: any) {
      console.error('Checkin error:', err);
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
          <button onClick={() => router.push('/gorun')} className="text-orange-500 hover:text-orange-600 font-semibold">
            ← Back to Runs
          </button>
        </div>
      </div>
    );
  }

  // ── Container routing ──────────────────────────────────────────────────────
  // 1. Has a check-in row  →  post-run container (you actually showed up)
  // 2. RSVP status "going" →  going container    (you're planning to)
  // 3. Anything else        →  pre-RSVP view      (public)

  if (myCheckin && hasSocialRunLifecycle(run)) {
    return (
      <CityRunPostRunContainer
        run={{
          id: run.id,
          title: run.title,
          date: run.date,
          cityRunType: run.cityRunType,
          runClub: run.runClub,
        }}
        myCheckin={myCheckin}
        allCheckins={checkins}
      />
    );
  }

  if (run.currentRSVP === 'going') {
    return (
      <>
        <TopNav />
        <CityRunGoingContainer run={run} onLeave={fetchAll} />
      </>
    );
  }

  return <CityRunPreRSVP run={run} onRsvp={handleRsvp} onCheckin={handleCheckin} rsvpLoading={rsvpLoading} onBack={() => router.push('/gorun')} allowCheckin={hasSocialRunLifecycle(run)} />;
}

// ─── Pre-RSVP Container ────────────────────────────────────────────────────────

function CityRunPreRSVP({
  run,
  onRsvp,
  onCheckin,
  rsvpLoading,
  onBack,
  allowCheckin,
}: {
  run: CityRunDetails;
  onRsvp: (status: 'going' | 'not-going') => void;
  onCheckin: () => void;
  rsvpLoading: boolean;
  onBack: () => void;
  allowCheckin: boolean;
}) {
  const going = (run.rsvps || []).filter((r) => r.status === 'going');
  const [runIsPast, setRunIsPast] = useState(false);

  useEffect(() => {
    setRunIsPast(isRunPast(run.date));
  }, [run.date]);

  const isSeries = run.runSeriesId != null;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav />
      <div className="mx-auto px-4 py-4 sm:py-6 max-w-5xl">
        <CityRunMobileTabs
          mode="pre-rsvp"
          run={run}
          runIsPast={runIsPast}
          rsvpLoading={rsvpLoading}
          onRsvp={onRsvp}
          onCheckin={onCheckin}
          onBack={onBack}
          allowCheckin={allowCheckin}
        />

        <div className="hidden lg:grid grid-cols-3 gap-6">
          <div className={`space-y-4 ${isSeries ? 'col-span-2' : 'col-span-2 order-2 lg:order-1'}`}>
            <CityRunDetailsSection run={run} showBackButton onBack={onBack} showHostCard />
            {isSeries ? (
              <>
                <CityRunGoingSummary count={going.length} />
                <CityRunRsvpPanel
                  runIsPast={runIsPast}
                  rsvpLoading={rsvpLoading}
                  onRsvp={onRsvp}
                  onCheckin={onCheckin}
                  runClub={run.runClub}
                  cityRunType={run.cityRunType}
                  runTitle={run.title}
                  allowCheckin={allowCheckin}
                />
              </>
            ) : null}
          </div>

          <div className={`space-y-4 ${isSeries ? '' : 'order-1 lg:order-2'}`}>
            {isSeries && run.runSeries ? (
              <CityRunSeriesPanel series={run.runSeries} runClub={run.runClub} />
            ) : (
              <>
                <CityRunGoingSummary count={going.length} />
                <CityRunRsvpPanel
                  runIsPast={runIsPast}
                  rsvpLoading={rsvpLoading}
                  onRsvp={onRsvp}
                  onCheckin={onCheckin}
                  runClub={run.runClub}
                  cityRunType={run.cityRunType}
                  runTitle={run.title}
                  allowCheckin={allowCheckin}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
