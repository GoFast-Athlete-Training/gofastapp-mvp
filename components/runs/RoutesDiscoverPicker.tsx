'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, Search, X } from 'lucide-react';
import api from '@/lib/api';
import {
  formatMilesForInput,
  snapshotFromRouteCatalogRow,
  type RouteCatalogRow,
  type SavedRouteSnapshot,
} from '@/lib/city-run/saved-route-snapshot';

export type { SavedRouteSnapshot };

type Props = {
  selectedRouteId: string | null;
  onSelect: (snapshot: SavedRouteSnapshot) => void;
  onClear: () => void;
  className?: string;
  /** Do not fetch until the user opens the list (avoids 401 noise on meetup step). */
  deferLoad?: boolean;
};

export default function RoutesDiscoverPicker({
  selectedRouteId,
  onSelect,
  onClear,
  className = '',
  deferLoad = false,
}: Props) {
  const [routes, setRoutes] = useState<RouteCatalogRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(!deferLoad);

  const loadRoutes = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'mine' });
      if (search.trim()) params.set('q', search.trim());
      const res = await api.get(`/routes?${params.toString()}`);
      setRoutes(Array.isArray(res.data?.routes) ? res.data.routes : []);
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    const t = window.setTimeout(() => void loadRoutes(query), query.trim() ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [query, loadRoutes, listOpen]);

  const selectedRow = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  );

  if (selectedRow) {
    const snap = snapshotFromRouteCatalogRow(selectedRow);
    const mapUrl = snap.mapImageUrl || snap.stravaMapUrl;
    const meta = [
      snap.distanceMiles != null ? `${formatMilesForInput(snap.distanceMiles)} mi` : null,
      snap.routeNeighborhood,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className={`rounded-xl border border-orange-200 bg-orange-50/50 p-3 ${className}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Route attached</p>
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery('');
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
        <div className="mt-2 flex gap-3">
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover border border-orange-100" />
          ) : (
            <div className="h-16 w-24 shrink-0 rounded-lg bg-orange-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{snap.name}</p>
            {meta ? <p className="text-xs text-gray-600 mt-0.5">{meta}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Saved routes
        </label>
        <div className="flex gap-3 text-xs font-semibold shrink-0">
          <Link href="/build-a-run/routes/new" className="text-orange-700 hover:underline">
            Build a route
          </Link>
          <Link href="/build-a-run/discover" className="text-orange-700 hover:underline">
            Discover
          </Link>
        </div>
      </div>
      {deferLoad && !listOpen ? (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="w-full rounded-lg border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50/40"
        >
          Search my saved routes
        </button>
      ) : null}
      {listOpen ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your routes (e.g. Teddy Friday)…"
              className="w-full border border-gray-300 rounded-lg py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {loading ? (
            <p className="text-xs text-gray-500">Loading your routes…</p>
          ) : routes.length === 0 ? (
            <p className="text-xs text-gray-500">
              No saved routes yet.{' '}
              <Link href="/build-a-run/routes/new" className="font-semibold text-orange-700 hover:underline">
                Build a route
              </Link>{' '}
              first.
            </p>
          ) : (
            <ul className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {routes.map((row) => {
                const snap = snapshotFromRouteCatalogRow(row);
                const mapUrl = snap.mapImageUrl || snap.stravaMapUrl;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(snap)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-orange-50/60 transition"
                    >
                      {mapUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mapUrl} alt="" className="h-10 w-14 shrink-0 rounded object-cover bg-gray-100" />
                      ) : (
                        <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-gray-100">
                          <MapPin className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 truncate">{snap.name}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {[snap.distanceMiles != null ? `${formatMilesForInput(snap.distanceMiles)} mi` : null, snap.routeNeighborhood]
                            .filter(Boolean)
                            .join(' · ') || 'Saved route'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
