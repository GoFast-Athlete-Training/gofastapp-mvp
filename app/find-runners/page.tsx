'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import RunnerCard from '@/components/find-runners/RunnerCard';
import type { DiscoverRunnerCard } from '@/lib/find-runners-types';

type RaceOption = {
  id: string;
  name: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  raceDate: string | null;
};

type LocationsPayload = {
  states: string[];
  citiesByState: Record<string, string[]>;
};

export default function FindRunnersPage() {
  const [runners, setRunners] = useState<DiscoverRunnerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    hasMore: false,
    limit: 20,
  });

  /** Form state (dropdowns) */
  const [filterRaceId, setFilterRaceId] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');

  /** Applied filters — only these affect the API until user clicks Find again */
  const [applied, setApplied] = useState<{
    mode: 'all' | 'race' | 'location';
    raceId: string;
    state: string;
    city: string;
  }>({ mode: 'all', raceId: '', state: '', city: '' });

  const [races, setRaces] = useState<RaceOption[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [availableLocations, setAvailableLocations] = useState<LocationsPayload>({
    states: [],
    citiesByState: {},
  });
  const [loadingLocations, setLoadingLocations] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rRes, lRes] = await Promise.all([
          fetch('/api/athlete/discover/races'),
          fetch('/api/athlete/discover/locations'),
        ]);
        const rData = await rRes.json();
        const lData = await lRes.json();
        if (rData.success) setRaces(rData.races || []);
        if (lData.success) {
          setAvailableLocations({
            states: lData.states || [],
            citiesByState: lData.citiesByState || {},
          });
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingRaces(false);
        setLoadingLocations(false);
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');

    if (applied.mode === 'race' && applied.raceId) {
      params.set('raceId', applied.raceId);
    }
    if (applied.mode === 'location') {
      if (applied.state) params.set('state', applied.state);
      if (applied.city) params.set('city', applied.city);
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/athlete/discover?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setRunners(data.runners || []);
          setPagination({
            total: data.pagination?.total ?? 0,
            totalPages: data.pagination?.totalPages ?? 1,
            hasMore: data.pagination?.hasMore ?? false,
            limit: data.pagination?.limit ?? 20,
          });
        } else {
          setRunners([]);
        }
      } catch {
        if (!cancelled) setRunners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, applied]);

  const applyRaceFilter = () => {
    setFilterState('');
    setFilterCity('');
    setPage(1);
    setApplied({
      mode: 'race',
      raceId: filterRaceId,
      state: '',
      city: '',
    });
  };

  const applyLocationFilter = () => {
    if (!filterState) return;
    setFilterRaceId('');
    setPage(1);
    setApplied({
      mode: 'location',
      raceId: '',
      state: filterState,
      city: filterCity,
    });
  };

  const handleClearFilters = () => {
    setFilterRaceId('');
    setFilterState('');
    setFilterCity('');
    setPage(1);
    setApplied({ mode: 'all', raceId: '', state: '', city: '' });
  };

  const hasActiveFilter = applied.mode !== 'all';

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 flex items-center gap-3">
                <Users className="w-10 h-10 md:w-12 md:h-12 text-orange-500 shrink-0" />
                Find other runners
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                See who&apos;s training for the same goals. Join their next public city run — same RSVP flow as everywhere else in GoFast.
              </p>
            </div>
            <Link
              href="/profile/discoverability"
              className="hidden sm:inline-flex items-center text-sm text-orange-600 hover:text-orange-700 font-medium whitespace-nowrap"
            >
              Improve your findability
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Find runners by</h2>
            <div className="flex flex-col lg:flex-row items-stretch gap-4 mb-4">
              <div
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  applied.mode === 'race' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">Goal race</label>
                <div className="space-y-2">
                  <select
                    value={filterRaceId}
                    onChange={(e) => setFilterRaceId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                    disabled={loadingRaces}
                  >
                    <option value="">All races</option>
                    {races.map((race) => {
                      const rd = race.raceDate
                        ? new Date(race.raceDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '';
                      return (
                        <option key={race.id} value={race.id}>
                          {race.name}
                          {rd ? ` (${rd})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={applyRaceFilter}
                    className="w-full px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
                  >
                    Find
                  </button>
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-center px-2">
                <span className="text-gray-400 font-medium text-sm">or</span>
              </div>

              <div
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  applied.mode === 'location' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">State</label>
                    <select
                      value={filterState}
                      onChange={(e) => {
                        setFilterState(e.target.value);
                        setFilterCity('');
                      }}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                      disabled={loadingLocations}
                    >
                      <option value="">Select state</option>
                      {availableLocations.states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {filterState && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">City (optional)</label>
                      <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white"
                      >
                        <option value="">All cities in {filterState}</option>
                        {(availableLocations.citiesByState[filterState] || []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={applyLocationFilter}
                    disabled={!filterState}
                    className="w-full px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Find
                  </button>
                </div>
              </div>
            </div>

            {hasActiveFilter && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition"
                >
                  Clear & show all
                </button>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
              <p className="text-gray-600">Finding runners…</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {runners.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">🏃</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">No runners yet</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {hasActiveFilter
                    ? 'No athletes match these filters with a public GoFast handle. Try clearing filters or check back later.'
                    : 'When athletes set a GoFast handle and share training, they will show up here.'}
                </p>
                <Link
                  href="/athlete-create-profile"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg"
                >
                  Set your handle
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                  <span>
                    Showing {(page - 1) * pagination.limit + 1}–
                    {(page - 1) * pagination.limit + runners.length} of {pagination.total} runner
                    {pagination.total === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {runners.map((runner) => (
                    <RunnerCard key={runner.athleteId} runner={runner} />
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="mt-10 flex justify-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-gray-700">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={!pagination.hasMore}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <Link href="/runcrew-discovery" className="text-orange-600 hover:text-orange-700 font-medium text-sm">
            Looking for a crew instead? Browse RunCrews →
          </Link>
        </div>
      </main>
    </div>
  );
}
