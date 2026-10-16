'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';
import {
  formatMilesForInput,
  snapshotFromAthleteRunRoute,
  type SavedRouteSnapshot,
} from '@/lib/city-run/saved-route-snapshot';

export type { SavedRouteSnapshot };

type Props = {
  selectedRouteId: string | null;
  onSelect: (snapshot: SavedRouteSnapshot) => void;
  onClear: () => void;
  athleteId?: string | null;
  className?: string;
};

export default function CityRunMyRoutesPicker({
  selectedRouteId,
  onSelect,
  onClear,
  athleteId: athleteIdProp,
  className = '',
}: Props) {
  const [runRoutes, setRunRoutes] = useState<AthleteRunRoutePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const athleteId = athleteIdProp ?? LocalStorageAPI.getAthleteId();

  const loadRoutes = useCallback(async () => {
    if (!athleteId) {
      setRunRoutes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/run-routes`);
      setRunRoutes(Array.isArray(res.data?.runRoutes) ? res.data.runRoutes : []);
    } catch {
      setLoadError('Could not load My Routes.');
      setRunRoutes([]);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runRoutes;
    return runRoutes.filter((row) => {
      const name = row.route.name.toLowerCase();
      const hood = row.route.routeNeighborhood?.toLowerCase() ?? '';
      const cap = row.caption?.toLowerCase() ?? '';
      const city = row.route.citySlug?.toLowerCase() ?? '';
      return name.includes(q) || hood.includes(q) || cap.includes(q) || city.includes(q);
    });
  }, [runRoutes, query]);

  const selectedRow = useMemo(
    () => runRoutes.find((r) => r.routeId === selectedRouteId) ?? null,
    [runRoutes, selectedRouteId]
  );

  if (!athleteId) {
    return (
      <p className={`text-xs text-gray-500 ${className}`}>
        Sign in to pick a route from My Routes.
      </p>
    );
  }

  if (selectedRow) {
    const snap = snapshotFromAthleteRunRoute(selectedRow);
    const mapUrl = snap.mapImageUrl || snap.stravaMapUrl;
    const meta = [
      snap.distanceMiles != null ? `${formatMilesForInput(snap.distanceMiles)} mi` : null,
      snap.routeNeighborhood,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className={`rounded-xl border border-violet-200 bg-violet-50/40 p-3 ${className}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">My route</p>
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
            <img src={mapUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover border border-violet-100" />
          ) : (
            <div className="h-16 w-24 shrink-0 rounded-lg bg-violet-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{snap.name}</p>
            {meta ? <p className="text-xs text-gray-600 mt-0.5">{meta}</p> : null}
            {selectedRow.caption ? (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selectedRow.caption}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className={`text-xs text-gray-500 ${className}`}>Loading My Routes…</p>;
  }

  if (loadError) {
    return (
      <p className={`text-xs text-red-600 ${className}`} role="alert">
        {loadError}
      </p>
    );
  }

  if (runRoutes.length === 0) {
    return (
      <p className={`text-xs text-gray-500 ${className}`}>
        No saved routes yet — add favorites under GoFast With Me → Routes, or paste a Strava link below.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Pick from My Routes <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your routes…"
          className="w-full border border-gray-300 rounded-lg py-2 pl-9 pr-3 text-sm"
        />
      </div>
      <ul className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-gray-500">No routes match your search.</li>
        ) : (
          filtered.map((row) => {
            const snap = snapshotFromAthleteRunRoute(row);
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
          })
        )}
      </ul>
    </div>
  );
}
