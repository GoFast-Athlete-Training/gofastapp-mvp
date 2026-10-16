'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Search } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import api from '@/lib/api';
import {
  formatMilesForInput,
  snapshotFromRouteCatalogRow,
  type RouteCatalogRow,
} from '@/lib/city-run/saved-route-snapshot';

export default function DiscoverRoutesPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [routes, setRoutes] = useState<RouteCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope: 'mine' });
      if (search.trim()) params.set('q', search.trim());
      const res = await api.get(`/routes?${params.toString()}`);
      setRoutes(Array.isArray(res.data?.routes) ? res.data.routes : []);
    } catch {
      setError('Could not load your routes.');
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(query), query.trim() ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [query, load]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <Link
              href="/build-a-run"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Run
            </Link>

            <h1 className="text-2xl font-bold text-gray-900">Find a route</h1>
            <p className="text-sm text-gray-600 mt-2 mb-6">
              Routes you saved by name — pick one, then create a run with it attached.
            </p>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (e.g. Teddy Friday)…"
                className="w-full border border-gray-300 rounded-xl py-2.5 pl-10 pr-3 text-sm bg-white"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : routes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-600">No saved routes yet.</p>
                <Link
                  href="/build-a-run/routes/new"
                  className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline"
                >
                  Build a route →
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {routes.map((row) => {
                  const snap = snapshotFromRouteCatalogRow(row);
                  const mapUrl = snap.mapImageUrl || snap.stravaMapUrl;
                  return (
                    <li
                      key={row.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row gap-4"
                    >
                      {mapUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mapUrl}
                          alt=""
                          className="h-24 w-full sm:w-32 shrink-0 rounded-lg object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="flex h-24 w-full sm:w-32 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                          <MapPin className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-gray-900">{snap.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          {[
                            snap.distanceMiles != null
                              ? `${formatMilesForInput(snap.distanceMiles)} mi`
                              : null,
                            snap.routeNeighborhood,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Saved route'}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/host-a-run?routeId=${encodeURIComponent(row.id)}`)
                          }
                          className="mt-3 text-sm font-semibold text-orange-700 hover:underline"
                        >
                          Create a run with this route →
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
