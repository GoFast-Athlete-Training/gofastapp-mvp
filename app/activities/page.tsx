'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ChevronLeft, ChevronRight, LineChart, Zap } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import { auth } from '@/lib/firebase';
import { athleteBearerFetchHeaders } from '@/lib/athlete-bearer-fetch-headers';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDays,
  computeWeekStats,
  formatWeekRangeLabel,
  formatLocalYmd,
  getSundayWeekStart,
  type ActivityHistoryFilter,
  type ActivityHistoryRow,
} from '@/lib/activities/activity-history';

const METERS_PER_MILE = 1609.34;

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function ingestionLabel(status: string): string {
  switch (status) {
    case 'MATCHED':
      return 'Matched';
    case 'UNMATCHED':
      return 'Unmatched';
    case 'RECEIVED':
      return 'Received';
    case 'INELIGIBLE':
      return 'Ineligible';
    default:
      return status.replace(/_/g, ' ');
  }
}

function ingestionClasses(status: string): string {
  switch (status) {
    case 'MATCHED':
      return 'bg-emerald-100 text-emerald-900';
    case 'UNMATCHED':
      return 'bg-amber-100 text-amber-900';
    case 'RECEIVED':
      return 'bg-sky-100 text-sky-900';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

export default function ActivitiesPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getSundayWeekStart(new Date()));
  const [filter, setFilter] = useState<ActivityHistoryFilter>('all');
  const [items, setItems] = useState<ActivityHistoryRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekEndExclusive = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekLabel = useMemo(
    () => formatWeekRangeLabel(weekStart, weekEndExclusive),
    [weekStart, weekEndExclusive]
  );
  const isCurrentWeek = useMemo(() => {
    const currentStart = getSundayWeekStart(new Date());
    return weekStart.getTime() === currentStart.getTime();
  }, [weekStart]);

  const weekStats = useMemo(() => computeWeekStats(items), [items]);

  const loadWeek = useCallback(
    async (append = false, cursor?: string | null) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const u = auth.currentUser;
        if (!u) return;
        const token = await u.getIdToken();
        const params = new URLSearchParams({
          from: formatLocalYmd(weekStart),
          to: formatLocalYmd(weekEndExclusive),
          filter,
          limit: '50',
        });
        if (append && cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/activities?${params.toString()}`, {
          headers: athleteBearerFetchHeaders(token),
        });
        const json = (await res.json()) as {
          items?: ActivityHistoryRow[];
          nextCursor?: string | null;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || 'Could not load activities');
        }
        const rows = Array.isArray(json.items) ? json.items : [];
        setItems((prev) => (append ? [...prev, ...rows] : rows));
        setNextCursor(json.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load activities');
        if (!append) setItems([]);
        setNextCursor(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [weekStart, weekEndExclusive, filter]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) router.replace('/welcome');
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    void loadWeek(false);
  }, [authReady, loadWeek]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity</h1>
                <p className="text-gray-600 leading-relaxed max-w-2xl">
                  Everything you actually did — runs, cross-training, and unmatched recordings.
                  For matched workout analysis, open{' '}
                  <Link href="/performance" className="font-medium text-orange-600 hover:text-orange-700">
                    Performance
                  </Link>
                  .
                </p>
              </div>
              <Link
                href="/performance"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100"
              >
                <LineChart className="h-4 w-4" aria-hidden />
                Performance analysis
              </Link>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-[180px] text-center">
                  <p className="text-sm font-semibold text-gray-900">{weekLabel}</p>
                  {isCurrentWeek ? (
                    <p className="text-xs text-orange-600 font-medium">This week</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                  disabled={isCurrentWeek}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                {(['all', 'unmatched'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                      filter === value
                        ? 'bg-orange-100 text-orange-800'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-orange-100">
                  <Zap className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Week totals</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {weekStats.miles.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">Miles</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {weekStats.activities}
                  </p>
                  <p className="text-sm text-gray-500">Activities</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {weekStats.minutes}
                  </p>
                  <p className="text-sm text-gray-500">Minutes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {weekStats.calories}
                  </p>
                  <p className="text-sm text-gray-500">Calories</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error}</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-gray-600">
                  {filter === 'unmatched'
                    ? 'No unmatched activities this week.'
                    : 'No activities this week yet.'}
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {items.map((activity) => {
                    const distMi =
                      activity.distance != null && activity.distance > 0
                        ? (activity.distance / METERS_PER_MILE).toFixed(2)
                        : null;
                    return (
                      <li key={activity.id}>
                        <Link
                          href={`/activities/${activity.id}`}
                          className="block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-orange-200/60 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-900 truncate">
                                  {activity.activityName || activity.activityType || 'Activity'}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ingestionClasses(activity.ingestionStatus)}`}
                                >
                                  {ingestionLabel(activity.ingestionStatus)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {formatWhen(activity.startTime)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                {distMi ? (
                                  <span className="text-orange-600 font-semibold">{distMi} mi</span>
                                ) : null}
                                {activity.duration != null ? (
                                  <span className="text-gray-600">
                                    {Math.floor(activity.duration / 60)} min
                                  </span>
                                ) : null}
                                {activity.activityType ? (
                                  <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                                    {activity.activityType.replace(/_/g, ' ')}
                                  </span>
                                ) : null}
                              </div>
                              {activity.matchedWorkoutId ? (
                                <p className="mt-2 text-xs text-emerald-800">
                                  Matched: {activity.matchedWorkoutTitle}
                                  {activity.matchedPlanName ? ` · ${activity.matchedPlanName}` : ''}
                                  {activity.communityPublishedAt ? ' · Story published' : ''}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100">
                              <Activity className="w-4 h-4 text-gray-500" />
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {nextCursor ? (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadWeek(true, nextCursor)}
                      className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load older this week'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
