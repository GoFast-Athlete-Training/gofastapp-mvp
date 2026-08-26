'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, MapPin, CheckCircle2 } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { formatCalendarDate } from '@/lib/calendar-date';
import { formatRunTime } from '@/utils/formatTime';

type RunnerRun = {
  id: string;
  title: string;
  date: string;
  city: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  runClub: { slug: string; name: string; logoUrl: string | null } | null;
  hasCheckin: boolean;
  isLive: boolean;
  needsWereYouThere: boolean;
};

type RunnerPoints = {
  total: number;
  breakdown: { rsvpGoing: number; checkins: number };
  weights: { rsvpGoing: number; checkin: number };
};

export default function RunnerPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunnerRun[]>([]);
  const [points, setPoints] = useState<RunnerPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/me/runner');
      setRuns(res.data?.goingRuns ?? []);
      setPoints(res.data?.points ?? null);
    } catch (err) {
      console.error('Runner load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCheckin = async (run: RunnerRun) => {
    setCheckingInId(run.id);
    try {
      await api.post(`/runs/${run.id}/checkin`, {});
      if (run.runClub?.slug) {
        router.push(`/runclub/${run.runClub.slug}`);
        return;
      }
      await load();
    } catch (err) {
      console.error('Check-in failed:', err);
    } finally {
      setCheckingInId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Runner</h1>
          <p className="mt-1 text-gray-600">Your runs, check-ins, and loyalty points.</p>
        </div>

        {points ? (
          <section className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-5 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-orange-100" aria-hidden />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-100">Your points</p>
                <p className="text-3xl font-bold">{points.total}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-orange-50">
              +{points.weights.rsvpGoing} I&apos;m in · +{points.weights.checkin} check-in
            </p>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Your runs</h2>
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-gray-700 font-medium">No active runs</p>
              <p className="mt-1 text-sm text-gray-500">RSVP to a club run — it&apos;ll show up here.</p>
              <Link
                href="/gorun"
                className="mt-4 inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Discover runs
              </Link>
            </div>
          ) : (
            runs.map((run) => {
              const timeStr = formatRunTime({
                startTimeHour: run.startTimeHour,
                startTimeMinute: run.startTimeMinute,
                startTimePeriod: run.startTimePeriod,
              });
              const dateStr = formatCalendarDate(run.date, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const clubSlug = run.runClub?.slug;

              return (
                <div
                  key={run.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {run.runClub ? (
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                          {run.runClub.name}
                        </p>
                      ) : null}
                      <p className="font-semibold text-gray-900">{run.title}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {dateStr}
                        {timeStr ? ` · ${timeStr}` : ''}
                      </p>
                      {run.city ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {run.city}
                        </p>
                      ) : null}
                    </div>
                    {run.hasCheckin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Checked in
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {run.isLive && !run.hasCheckin ? (
                      <button
                        type="button"
                        disabled={checkingInId !== null}
                        onClick={() => void handleCheckin(run)}
                        className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {checkingInId === run.id ? 'Checking in…' : 'Check in'}
                      </button>
                    ) : null}
                    {run.needsWereYouThere && !run.hasCheckin ? (
                      <button
                        type="button"
                        disabled={checkingInId !== null}
                        onClick={() => void handleCheckin(run)}
                        className="inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {checkingInId === run.id ? 'Saving…' : 'Were you there?'}
                      </button>
                    ) : null}
                    {clubSlug ? (
                      <Link
                        href={`/runclub/${clubSlug}`}
                        className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Club home
                      </Link>
                    ) : (
                      <Link
                        href={`/gorun/${run.id}`}
                        className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Run details
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
