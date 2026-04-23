'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { MapPin, Calendar, Clock, Trophy } from 'lucide-react';

type HubRunRow = { id: string; title: string; date: string; city: string };

interface Run {
  id: string;
  title: string;
  gofastCity: string;
  isRecurring: boolean;
  dayOfWeek: string | null;
  startDate: string;
  date: string;
  endDate: string | null;
  runClubSlug: string | null;
  runCrewId: string | null;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
}

function GoRunPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<Run[]>([]);
  const [myGoingRuns, setMyGoingRuns] = useState<HubRunRow[]>([]);
  const [myPastRuns, setMyPastRuns] = useState<HubRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string>('');
  const [runClubSlug, setRunClubSlug] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);

  // Read runClubSlug from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = searchParams.get('runClubSlug');
    setRunClubSlug(slug);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void fetchHubData();
  }, [cityFilter, dayFilter, runClubSlug, router]);

  const fetchHubData = async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      console.warn('// REDIRECT DISABLED: /signup');
      setMyGoingRuns([]);
      setMyPastRuns([]);
      setRuns([]);
      setAvailableCities([]);
      setAvailableDays([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (cityFilter && cityFilter !== 'All Cities') {
        params.append('gofastCity', cityFilter);
      }
      if (dayFilter && dayFilter !== 'All Days') {
        params.append('day', dayFilter);
      }
      if (runClubSlug) {
        params.append('runClubSlug', runClubSlug);
      }

      const [runsRes, goingRes, pastRes] = await Promise.allSettled([
        api.get(`/runs?${params.toString()}`),
        api.get('/me/my-going-runs'),
        api.get('/me/my-past-runs'),
      ]);

      if (goingRes.status === 'fulfilled') {
        const list = goingRes.value.data?.runs;
        setMyGoingRuns(Array.isArray(list) ? list : []);
      } else {
        setMyGoingRuns([]);
      }

      if (pastRes.status === 'fulfilled') {
        const list = pastRes.value.data?.runs;
        setMyPastRuns(Array.isArray(list) ? list : []);
      } else {
        setMyPastRuns([]);
      }

      if (runsRes.status === 'fulfilled' && runsRes.value.data?.success) {
        const fetchedRuns = runsRes.value.data.runs || [];
        setRuns(fetchedRuns);

        const cities: string[] = [...new Set(fetchedRuns.map((r: Run) => r.gofastCity))].sort() as string[];
        setAvailableCities(cities);

        const days = new Set<string>();
        fetchedRuns.forEach((r: Run) => {
          if (r.isRecurring && r.dayOfWeek) {
            days.add(r.dayOfWeek);
          } else {
            const date = new Date(r.startDate);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            days.add(dayNames[date.getDay()]);
          }
        });
        const sortedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].filter(
          (d) => days.has(d)
        );
        setAvailableDays(sortedDays);
      } else {
        setRuns([]);
        if (runsRes.status === 'rejected') {
          console.error('Error fetching runs:', runsRes.reason);
          const err = runsRes.reason as { response?: { status?: number } };
          if (err?.response?.status === 401) {
            console.warn('// REDIRECT DISABLED: /signup');
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error loading run hub:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour: number | null, minute: number | null, period: string | null) => {
    if (hour === null || minute === null) return '';
    const minStr = minute.toString().padStart(2, '0');
    return `${hour}:${minStr} ${period || 'AM'}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const formatHubRunDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Run hub</h1>
          <p className="text-gray-600">Your meetups and runs near you</p>
        </div>

        {myGoingRuns.length > 0 ? (
          <section className="mb-10" aria-labelledby="your-runs-heading">
            <h2 id="your-runs-heading" className="text-lg font-bold text-sky-900 mb-3">
              Your runs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGoingRuns.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border-2 border-sky-200 bg-sky-50/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">You&apos;re going</p>
                    <p className="mt-1 font-semibold text-gray-900 leading-snug">{r.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatHubRunDate(r.date)}
                      {r.city ? ` · ${r.city}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/gorun/${r.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
                  >
                    Open meetup →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {myPastRuns.length > 0 ? (
          <section className="mb-10" aria-labelledby="post-run-recaps-heading">
            <h2 id="post-run-recaps-heading" className="text-lg font-bold text-orange-900 mb-3">
              Post-run recaps
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myPastRuns.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div className="flex gap-3 min-w-0">
                    <Trophy className="h-9 w-9 shrink-0 text-orange-500" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">
                        You ran &quot;{r.title}&quot; · {formatHubRunDate(r.date)}
                        {r.city ? ` · ${r.city}` : ''}
                      </p>
                      <p className="text-sm text-orange-900/85 mt-1">Add shouts + see the crew →</p>
                    </div>
                  </div>
                  <Link
                    href={`/gorun/${r.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
                  >
                    Open recap
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* RunClub Filter Banner */}
        {runClubSlug && (
          <div className="mb-6 bg-sky-50 border border-sky-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-900">
                  Showing runs for: <span className="font-semibold">{runClubSlug}</span>
                </p>
                <p className="text-xs text-sky-700 mt-1">
                  Viewing all runs from this run club
                </p>
              </div>
              <button
                onClick={() => {
                  setRunClubSlug(null);
                  // Remove from URL
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.delete('runClubSlug');
                  router.push(newUrl.pathname + newUrl.search);
                }}
                className="text-xs text-sky-700 hover:text-sky-900 underline"
              >
                Clear filter
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Discover runs</h2>
          <p className="text-gray-600">Select your city and see what&apos;s happening</p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Cities</option>
              {availableCities.map(city => (
                <option key={city} value={city}>
                  {city.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Day
            </label>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Days</option>
              {availableDays.map(day => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Runs List */}
        {runs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runs.map((run) => {
              // Format city name from gofastCity or use meetUpCity
              const cityName = run.meetUpCity || 
                run.gofastCity.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              return (
                <div
                  key={run.id}
                  onClick={() => router.push(`/gorun/${run.id}`)}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border border-gray-200 hover:border-orange-300"
                >
                  {/* Run Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-4 line-clamp-2">
                    {run.title}
                  </h3>

                  {/* Mileage & Pace */}
                  <div className="flex items-center gap-4 mb-3">
                    {run.totalMiles && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">🏃</span>
                        <span className="font-semibold">{run.totalMiles}</span>
                        <span className="text-sm text-gray-600">miles</span>
                      </div>
                    )}
                    {run.pace && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">⚡</span>
                        <span className="font-semibold">{run.pace}</span>
                      </div>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{cityName}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-1.5 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {run.isRecurring ? (
                          <span>
                            Every <span className="font-semibold text-gray-900">{run.dayOfWeek}</span>
                          </span>
                        ) : (
                          formatDate(run.startDate)
                        )}
                      </span>
                    </div>
                    {(run.startTimeHour !== null && run.startTimeMinute !== null) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}</span>
                      </div>
                    )}
                  </div>

                  {/* Location (truncated) */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-700 font-medium line-clamp-1">
                      {run.meetUpPoint}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/gorun/${run.id}`);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-semibold transition text-sm"
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No runs found
            </h2>
            <p className="text-gray-600">
              {cityFilter || dayFilter
                ? 'Try adjusting your filters to see more runs'
                : 'Check back soon for upcoming runs in your area'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoRunPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading runs...</p>
        </div>
      </div>
    }>
      <GoRunPageContent />
    </Suspense>
  );
}

