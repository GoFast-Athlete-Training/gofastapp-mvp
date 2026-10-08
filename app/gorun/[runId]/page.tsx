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
import CityRunWorkoutCard from '@/components/runs/CityRunWorkoutCard';
import CityRunPeopleSection, { CityRunGoingSummary } from '@/components/runs/CityRunPeopleSection';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import {
  isRunPast,
  type CityRunCheckin,
  type CityRunDetails,
  type CityRunRsvp,
} from '@/components/runs/city-run-types';
import { isCityRunToday } from '@/lib/city-run-clock';
import { hasSocialRunLifecycle } from '@/lib/city-run-copy';
import {
  mapPublicRunToCityRunDetails,
  type PublicCityRunPayload,
} from '@/lib/city-run/map-public-run-to-details';

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
  const [isGuestSession, setIsGuestSession] = useState(false);

  useEffect(() => {
    if (!runId) return;

    // Wait for Firebase to resolve: guests load public APIs; signed-in athletes use authed run.
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      const guest = !user;
      setIsGuestSession(guest);
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
      void fetchAll(guest);
    });
  }, [runId]);

  const fetchAll = async (guest: boolean) => {
    try {
      setLoading(true);
      setError(null);

      if (guest) {
        const segment = encodeURIComponent(runId);
        const runRes = await fetch(`/api/runs/public/${segment}`, { cache: 'no-store' });
        const runJson = (await runRes.json()) as {
          success?: boolean;
          run?: PublicCityRunPayload;
          error?: string;
        };
        if (!runRes.ok || !runJson.success || !runJson.run) {
          setError(runRes.status === 404 ? 'Run not found' : runJson.error || 'Run not found');
          setRun(null);
          return;
        }

        let rsvps: CityRunRsvp[] = [];
        try {
          const rsvpRes = await fetch(`/api/runs/${segment}/rsvp`, { cache: 'no-store' });
          const rsvpJson = (await rsvpRes.json()) as {
            success?: boolean;
            rsvps?: CityRunRsvp[];
          };
          if (rsvpRes.ok && rsvpJson.success && Array.isArray(rsvpJson.rsvps)) {
            rsvps = rsvpJson.rsvps;
          }
        } catch (rsvpErr) {
          console.warn('gorun: public RSVP list failed', rsvpErr);
        }

        const loaded = mapPublicRunToCityRunDetails(runJson.run, rsvps);
        setRun(loaded);
        setCheckins([]);
        setMyCheckin(null);

        if (loaded.slug && runId && loaded.slug !== runId) {
          router.replace(`/gorun/${loaded.slug}`);
        }
        return;
      }

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

  const joinRunPath = (r: CityRunDetails) =>
    `/join/run/${encodeURIComponent(r.slug ?? r.id)}`;

  const handleRsvp = async (status: 'going' | 'not-going') => {
    if (!run) return;
    if (isGuestSession || !auth.currentUser) {
      if (status === 'going') {
        router.push(joinRunPath(run));
      }
      return;
    }
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status });
      await fetchAll(false);
    } catch (err: any) {
      console.error('RSVP error:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!run) return;
    if (isGuestSession || !auth.currentUser) {
      router.push(joinRunPath(run));
      return;
    }
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/checkin`, {});
      await fetchAll(false);
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
  // 2. Host + past + today →  post-run recap (crew + thank shouts, no check-in required)
  // 3. RSVP status "going" →  going container    (you're planning to)
  // 4. Anything else        →  pre-RSVP view      (public)

  const runIsPast = isRunPast(run.date, {
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    timezone: run.timezone,
  });
  const runIsToday = isCityRunToday({
    date: run.date,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    timezone: run.timezone,
  });
  if ((myCheckin) && hasSocialRunLifecycle(run)) {
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
        hostRecapMode={false}
      />
    );
  }

  if (run.currentRSVP === 'going') {
    return (
      <>
        <TopNav />
        <CityRunGoingContainer run={run} onLeave={() => void fetchAll(isGuestSession)} />
      </>
    );
  }

  return (
    <CityRunPreRSVP
      run={run}
      onRsvp={handleRsvp}
      onCheckin={handleCheckin}
      rsvpLoading={rsvpLoading}
      onBack={() => router.push('/gorun')}
      allowCheckin={hasSocialRunLifecycle(run) && !isGuestSession}
    />
  );
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
    setRunIsPast(
      isRunPast(run.date, {
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
      })
    );
  }, [run.date, run.startTimeHour, run.startTimeMinute, run.startTimePeriod, run.timezone]);

  const isSeries = run.runSeriesId != null;
  const hasWorkout =
    Boolean(run.workoutId || run.workout) ||
    Boolean(run.workout?.workoutNarrative?.trim()) ||
    Boolean(run.workoutDescription?.trim());

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
            {hasWorkout ? (
              <CityRunWorkoutCard
                workoutId={run.workoutId}
                workout={run.workout}
                workoutDescription={run.workoutDescription}
              />
            ) : null}
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
              <CityRunSeriesPanel
                series={run.runSeries}
                runClub={run.runClub}
                occurrenceMeetUpPoint={run.meetUpPoint}
                occurrenceStartTimeHour={run.startTimeHour}
                occurrenceStartTimeMinute={run.startTimeMinute}
                occurrenceStartTimePeriod={run.startTimePeriod}
              />
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
