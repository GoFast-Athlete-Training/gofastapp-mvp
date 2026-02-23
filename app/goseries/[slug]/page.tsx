'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import {
  MapPin, Clock, Calendar, ArrowLeft, Repeat,
  ChevronRight, Users
} from 'lucide-react';

interface RunClub {
  id: string;
  slug: string | null;
  name: string | null;
  logoUrl: string | null;
  city: string | null;
}

interface NextRun {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  rsvpCount: number;
}

interface UpcomingRun {
  id: string;
  title: string;
  date: string;
  rsvpCount: number;
}

interface Series {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  dayOfWeek: string;
  gofastCity: string | null;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  runClub: RunClub | null;
  nextRun: NextRun | null;
  upcomingRuns: UpcomingRun[];
}

function formatTime(hour: number | null, minute: number | null, period: string | null) {
  if (hour === null || minute === null) return null;
  return `${hour}:${String(minute).padStart(2, '0')} ${period ?? 'AM'}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function GoSeriesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get(`/api/run-series/public/${slug}`)
      .then((res) => {
        if (res.data?.success && res.data.series) {
          setSeries(res.data.series);
        } else {
          setError('Series not found');
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) setError('Series not found');
        else setError('Failed to load series');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Series not found'}</h1>
          <button onClick={() => router.back()} className="text-orange-500 hover:text-orange-600 font-semibold">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const seriesTime = formatTime(series.startTimeHour, series.startTimeMinute, series.startTimePeriod);
  const productAppBase = (process.env.NEXT_PUBLIC_PRODUCT_APP_URL || '').replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left / main column ── */}
          <div className="lg:col-span-2 space-y-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {/* Club header */}
            {series.runClub && (
              <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                {series.runClub.logoUrl && (
                  <img
                    src={series.runClub.logoUrl}
                    alt={series.runClub.name ?? ''}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                  />
                )}
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hosted by</div>
                  <div className="font-bold text-gray-900">{series.runClub.name}</div>
                  {series.runClub.city && <div className="text-sm text-gray-500">{series.runClub.city}</div>}
                </div>
              </div>
            )}

            {/* Series details */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Recurring Series</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-5">
                {series.name ?? `${capitalize(series.dayOfWeek)} Run`}
              </h1>

              <div className="space-y-3 text-gray-700">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Every <strong>{capitalize(series.dayOfWeek)}</strong></span>
                </div>
                {seriesTime && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{seriesTime}</span>
                  </div>
                )}
                {series.meetUpPoint && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium">{series.meetUpPoint}</div>
                      {(series.meetUpStreetAddress || series.meetUpCity) && (
                        <div className="text-sm text-gray-500">
                          {[series.meetUpStreetAddress, series.meetUpCity, series.meetUpState]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                      {series.meetUpLat && series.meetUpLng && (
                        <a
                          href={`https://www.google.com/maps?q=${series.meetUpLat},${series.meetUpLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-500 hover:text-orange-600"
                        >
                          Open in Maps →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {series.description && (
                <p className="mt-5 text-gray-600 text-sm whitespace-pre-wrap border-t border-gray-100 pt-5 leading-relaxed">
                  {series.description}
                </p>
              )}
            </div>

            {/* Upcoming runs list */}
            {series.upcomingRuns.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Upcoming runs in this series</h2>
                <ul className="divide-y divide-gray-100">
                  {series.upcomingRuns.map((r) => (
                    <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-gray-300 shrink-0" />
                        <span className="font-medium text-gray-900">{formatShortDate(r.date)}</span>
                        {r.rsvpCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Users className="h-3 w-3" /> {r.rsvpCount}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/gorun/${r.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600"
                      >
                        RSVP <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {series.upcomingRuns.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">
                No upcoming runs scheduled yet — check back soon.
              </div>
            )}
          </div>

          {/* ── Right column: Next run card ── */}
          <div className="lg:col-span-1 space-y-4">
            {series.nextRun ? (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-orange-100">
                <div className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-3">
                  Next run
                </div>
                <div className="font-bold text-gray-900 mb-3">{formatDate(series.nextRun.date)}</div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {formatTime(series.nextRun.startTimeHour, series.nextRun.startTimeMinute, series.nextRun.startTimePeriod) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{formatTime(series.nextRun.startTimeHour, series.nextRun.startTimeMinute, series.nextRun.startTimePeriod)}</span>
                    </div>
                  )}
                  {series.nextRun.meetUpPoint && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>
                        {series.nextRun.meetUpPoint}
                        {series.nextRun.meetUpCity && (
                          <span className="text-gray-400"> · {series.nextRun.meetUpCity}</span>
                        )}
                      </span>
                    </div>
                  )}
                  {series.nextRun.rsvpCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{series.nextRun.rsvpCount} going</span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/gorun/${series.nextRun.id}`}
                  className="block w-full text-center py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition text-sm"
                >
                  RSVP for this run →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 text-center">
                <Repeat className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No upcoming runs scheduled yet.</p>
                <p className="text-xs text-gray-300 mt-1">Check back soon.</p>
              </div>
            )}

            {/* Series info chip */}
            <div className="bg-orange-50 rounded-xl p-4 text-sm text-orange-800">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Repeat className="h-4 w-4" />
                Recurring every {capitalize(series.dayOfWeek)}
              </div>
              <p className="text-orange-700 text-xs leading-relaxed">
                This is a standing run — same time, same spot every week.
                RSVP for any individual run above.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
