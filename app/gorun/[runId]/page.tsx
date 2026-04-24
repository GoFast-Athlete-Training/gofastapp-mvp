'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CityRunGoingContainer from '@/components/runs/CityRunGoingContainer';
import CityRunPostRunContainer from '@/components/runs/CityRunPostRunContainer';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { MapPin, Clock, Calendar, Map, ArrowLeft, Repeat } from 'lucide-react';
import CityRunRouteMedia from '@/components/runs/CityRunRouteMedia';

interface RunClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface RunCrew {
  id: string;
  name: string;
  logo: string | null;
  handle: string;
}

interface Checkin {
  id: string;
  runId: string;
  athleteId: string;
  checkedInAt: string;
  runPhotoUrl: string | null;
  runShouts: string | null;
  Athlete?: { id: string; firstName: string; lastName: string; photoURL: string | null };
}

interface RunSeries {
  id: string;
  name: string | null;
  dayOfWeek: string;
  description: string | null;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  gofastCity: string | null;
}

interface Run {
  id: string;
  slug?: string | null;
  title: string;
  gofastCity: string;
  dayOfWeek: string | null;
  date: string;
  runSeriesId: string | null;
  runSeries: RunSeries | null;
  runClubSlug: string | null;
  runCrewId: string | null;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  runClub?: RunClub | null;
  runCrew?: RunCrew | null;
  rsvps?: any[];
  currentRSVP?: string | null;
}

export default function GoRunPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [myCheckin, setMyCheckin] = useState<Checkin | null>(null);
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
      const loaded = runRes.data.run as Run;
      setRun(loaded);

      if (loaded.slug && runId && loaded.slug !== runId) {
        router.replace(`/gorun/${loaded.slug}`);
      }

      // Checkin fetch is secondary — a 401/500 here (e.g. missing migration on
      // preview DB, or unauthenticated guest) must NOT kill the run page
      try {
        const checkinRes = await api.get(`/runs/${runId}/checkin`);
        if (checkinRes.data.success) {
          const list = (checkinRes.data.checkins || []) as Checkin[];
          const my = (checkinRes.data.myCheckin ?? null) as Checkin | null;
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

  if (myCheckin) {
    return (
      <CityRunPostRunContainer
        run={{
          id: run.id,
          title: run.title,
          date: run.date,
          meetUpPoint: run.meetUpPoint,
          meetUpCity: run.meetUpCity,
          meetUpStreetAddress: run.meetUpStreetAddress,
          totalMiles: run.totalMiles,
          pace: run.pace,
          stravaMapUrl: run.stravaMapUrl,
          routePhotos: run.routePhotos,
          mapImageUrl: run.mapImageUrl,
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

  return <CityRunPreRSVP run={run} onRsvp={handleRsvp} onCheckin={handleCheckin} rsvpLoading={rsvpLoading} onBack={() => router.push('/gorun')} />;
}

// ─── Pre-RSVP Container ────────────────────────────────────────────────────────

function CityRunPreRSVP({
  run,
  onRsvp,
  onCheckin,
  rsvpLoading,
  onBack,
}: {
  run: Run;
  onRsvp: (status: 'going' | 'not-going') => void;
  onCheckin: () => void;
  rsvpLoading: boolean;
  onBack: () => void;
}) {
  const going = (run.rsvps || []).filter((r: any) => r.status === 'going');
  const [runIsPast, setRunIsPast] = useState(false);

  useEffect(() => {
    const runPlus4h = new Date(new Date(run.date).getTime() + 4 * 60 * 60 * 1000);
    setRunIsPast(runPlus4h < new Date());
  }, [run.date]);

  const formatTime = () => {
    if (run.startTimeHour === null || run.startTimeMinute === null) return null;
    const min = String(run.startTimeMinute).padStart(2, '0');
    return `${run.startTimeHour}:${min} ${run.startTimePeriod || 'AM'}`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Series sidebar: only when this run row has runSeriesId in DB (not inferred from URL slug).
  const isSeries = run.runSeriesId != null;

  const goingSummary =
    going.length > 0 ? (
      <div className="bg-white rounded-xl shadow-sm px-6 py-4 text-sm text-gray-600">
        <span className="font-semibold text-gray-900">
          {going.length} {going.length === 1 ? 'person' : 'people'} going
        </span>{' '}
        · RSVP to see who
      </div>
    ) : null;

  const rsvpColumn =
    runIsPast ? (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 mb-4">This run already happened. Were you there?</p>
        <button
          onClick={onCheckin}
          disabled={rsvpLoading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {rsvpLoading ? 'Loading…' : "See the crew's recap →"}
        </button>
      </div>
    ) : (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 mb-4">RSVP to join the run chat and see who&apos;s going.</p>
        <button
          onClick={() => onRsvp('going')}
          disabled={rsvpLoading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {rsvpLoading ? 'Saving…' : "I'm going"}
        </button>
      </div>
    );

  const mainColumn = (
    <>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Runs
      </button>

      {run.runClub && (
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
          {run.runClub.logoUrl && (
            <img src={run.runClub.logoUrl} alt={run.runClub.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100" />
          )}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hosted by</div>
            <div className="font-bold text-gray-900">{run.runClub.name}</div>
            {run.runClub.city && <div className="text-sm text-gray-500">{run.runClub.city}</div>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5">{run.title}</h1>

        <div className="space-y-3 text-gray-700">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>{formatDate(run.date)}</span>
          </div>
          {formatTime() && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{formatTime()}</span>
            </div>
          )}
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              <div className="font-medium">{run.meetUpPoint}</div>
              {(run.meetUpStreetAddress || run.meetUpCity) && (
                <div className="text-sm text-gray-500">
                  {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}
                </div>
              )}
              {run.meetUpLat && run.meetUpLng && (
                <a
                  href={`https://www.google.com/maps?q=${run.meetUpLat},${run.meetUpLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-500 hover:text-orange-600"
                >
                  Open in Maps →
                </a>
              )}
            </div>
          </div>
          {(run.totalMiles || run.pace) && (
            <div className="flex gap-6 text-sm pt-1">
              {run.totalMiles && <span><span className="text-gray-400">Distance</span> {run.totalMiles} mi</span>}
              {run.pace && <span><span className="text-gray-400">Pace</span> {run.pace}</span>}
            </div>
          )}
          {run.stravaMapUrl && (
            <a href={run.stravaMapUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 pt-1">
              <Map className="h-4 w-4" /> View Route
            </a>
          )}
        </div>

        {run.description && (
          <p className="mt-5 text-gray-700 text-sm whitespace-pre-wrap border-t border-gray-100 pt-5">
            {run.description}
          </p>
        )}
      </div>

      <CityRunRouteMedia routePhotos={run.routePhotos} mapImageUrl={run.mapImageUrl} />
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="mx-auto px-4 py-6 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`space-y-4 ${isSeries ? 'lg:col-span-2' : 'lg:col-span-2 order-2 lg:order-1'}`}
          >
            {mainColumn}
            {isSeries && (
              <>
                {goingSummary}
                {rsvpColumn}
              </>
            )}
          </div>

          <div
            className={`space-y-4 ${isSeries ? '' : 'order-1 lg:order-2'}`}
          >
            {isSeries && run.runSeries ? (
              <SeriesPanel series={run.runSeries} runClub={run.runClub} />
            ) : (
              <>
                {goingSummary}
                {rsvpColumn}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Series Panel ─────────────────────────────────────────────────────────────

function SeriesPanel({ series, runClub }: { series: RunSeries; runClub?: RunClub | null }) {
  const timeStr = series.startTimeHour != null
    ? `${series.startTimeHour}:${String(series.startTimeMinute ?? 0).padStart(2, '0')} ${series.startTimePeriod ?? 'AM'}`
    : null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-orange-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-orange-50 rounded-lg">
          <Repeat className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Part of a series</div>
          <div className="font-semibold text-gray-900 text-sm">{series.name ?? 'Recurring Run'}</div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span>Every {capitalize(series.dayOfWeek)}</span>
        </div>
        {timeStr && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span>{timeStr}</span>
          </div>
        )}
        {series.meetUpPoint && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              {series.meetUpPoint}
              {series.meetUpCity && <span className="text-gray-400"> · {series.meetUpCity}{series.meetUpState ? `, ${series.meetUpState}` : ''}</span>}
            </span>
          </div>
        )}
      </div>

      {series.description && (
        <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 leading-relaxed">
          {series.description}
        </p>
      )}

      {runClub && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Hosted by</p>
          <div className="flex items-center gap-2">
            {runClub.logoUrl && (
              <img src={runClub.logoUrl} alt={runClub.name} className="w-7 h-7 rounded-full object-cover" />
            )}
            <span className="text-sm font-medium text-gray-700">{runClub.name}</span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">This is a recurring run — same time, same place every {capitalize(series.dayOfWeek)}.</p>
      </div>
    </div>
  );
}
