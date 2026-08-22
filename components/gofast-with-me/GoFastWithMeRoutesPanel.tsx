'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';

type Props = {
  athleteId: string;
};

type RouteCreateDraft = {
  name: string;
  stravaUrl: string;
  stravaMapUrl: string;
  mapImageUrl: string;
  distanceMiles: string;
  citySlug: string;
  routeNeighborhood: string;
  caption: string;
  sortOrder: string;
  isPublished: boolean;
};

type CatalogRouteHit = {
  id: string;
  name: string;
  stravaUrl: string | null;
  distanceMiles: number | null;
  citySlug: string | null;
  routeNeighborhood: string | null;
};

type RunRouteDraft = {
  caption: string;
  sortOrder: string;
  isPublished: boolean;
};

const EMPTY_CREATE: RouteCreateDraft = {
  name: '',
  stravaUrl: '',
  stravaMapUrl: '',
  mapImageUrl: '',
  distanceMiles: '',
  citySlug: '',
  routeNeighborhood: '',
  caption: '',
  sortOrder: '0',
  isPublished: true,
};

function runRouteToDraft(row: AthleteRunRoutePayload): RunRouteDraft {
  return {
    caption: row.caption ?? '',
    sortOrder: String(row.sortOrder),
    isPublished: row.visibility === 'published',
  };
}

export default function GoFastWithMeRoutesPanel({ athleteId }: Props) {
  const [runRoutes, setRunRoutes] = useState<AthleteRunRoutePayload[]>([]);
  const [createDraft, setCreateDraft] = useState<RouteCreateDraft>(EMPTY_CREATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogRouteHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRunRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/run-routes`);
      setRunRoutes(Array.isArray(res.data?.runRoutes) ? res.data.runRoutes : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load myRunRoutes.');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadRunRoutes();
  }, [loadRunRoutes]);

  const featureRoute = async (
    routeId: string,
    opts: { caption?: string; sortOrder?: number; isPublished?: boolean }
  ) => {
    const res = await api.post(`/athlete/${athleteId}/run-routes`, {
      routeId,
      caption: opts.caption ?? null,
      sortOrder: opts.sortOrder ?? 0,
      isPublished: opts.isPublished ?? true,
    });
    if (res.data?.runRoute) {
      const row = res.data.runRoute as AthleteRunRoutePayload;
      setRunRoutes((prev) => {
        const rest = prev.filter((r) => r.id !== row.id && r.routeId !== row.routeId);
        return [row, ...rest];
      });
    } else {
      await loadRunRoutes();
    }
  };

  const createAndFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDraft.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const routeRes = await api.post('/routes', {
        name: createDraft.name.trim(),
        stravaUrl: createDraft.stravaUrl.trim() || undefined,
        stravaMapUrl: createDraft.stravaMapUrl.trim() || undefined,
        mapImageUrl: createDraft.mapImageUrl.trim() || undefined,
        distanceMiles: createDraft.distanceMiles.trim()
          ? parseFloat(createDraft.distanceMiles)
          : undefined,
        citySlug: createDraft.citySlug.trim() || undefined,
        routeNeighborhood: createDraft.routeNeighborhood.trim() || undefined,
      });
      const routeId = routeRes.data?.route?.id as string | undefined;
      if (!routeId) throw new Error('Could not create route');

      await featureRoute(routeId, {
        caption: createDraft.caption.trim() || undefined,
        sortOrder: Number(createDraft.sortOrder) || 0,
        isPublished: createDraft.isPublished,
      });

      setCreateDraft(EMPTY_CREATE);
      setSuccess(createDraft.isPublished ? 'Route published.' : 'Route saved as draft.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not save route.');
    } finally {
      setSaving(false);
    }
  };

  const searchCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (searchCity.trim()) params.set('citySlug', searchCity.trim());
      const res = await api.get(`/routes?${params.toString()}`);
      setSearchResults(Array.isArray(res.data?.routes) ? res.data.routes : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not search routes.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const updateRunRoute = async (runRouteId: string, next: RunRouteDraft) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put(`/athlete/${athleteId}/run-routes/${runRouteId}`, {
        caption: next.caption.trim() || null,
        sortOrder: Number(next.sortOrder) || 0,
        isPublished: next.isPublished,
      });
      if (res.data?.runRoute) {
        const updated = res.data.runRoute as AthleteRunRoutePayload;
        setRunRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setSuccess(updated.visibility === 'published' ? 'Route published.' : 'Route saved as draft.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not update route.');
      throw err;
    }
  };

  const removeRunRoute = async (runRouteId: string) => {
    if (!confirm('Remove this route from your page? The shared catalog entry stays for others.')) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/athlete/${athleteId}/run-routes/${runRouteId}`);
      setRunRoutes((prev) => prev.filter((r) => r.id !== runRouteId));
      setSuccess('Route removed from your page.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not remove route.');
    }
  };

  const publishedCount = runRoutes.filter((r) => r.visibility === 'published').length;

  return (
    <section id="myrunroutes" className="space-y-4 pt-6 border-t border-gray-200">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">myRunRoutes</h3>
        <p className="text-xs text-gray-600 mt-1">
          Share routes you love — your own Strava routes or favorites from the city catalog. Same route can
          appear on many athletes&apos; pages.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void createAndFeature(e)}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3"
      >
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Add my route</h4>
            <p className="text-xs text-gray-600 mt-1">
              Paste a Strava route link — check out this run I did.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-gray-700">Route name</span>
            <input
              value={createDraft.name}
              onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Hains Point 5-mile loop"
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-gray-700">Strava route URL</span>
            <input
              value={createDraft.stravaUrl}
              onChange={(e) => setCreateDraft((p) => ({ ...p, stravaUrl: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://www.strava.com/routes/…"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Distance (mi)</span>
            <input
              value={createDraft.distanceMiles}
              onChange={(e) => setCreateDraft((p) => ({ ...p, distanceMiles: e.target.value }))}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">City slug</span>
            <input
              value={createDraft.citySlug}
              onChange={(e) => setCreateDraft((p) => ({ ...p, citySlug: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="dc"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-gray-700">Your caption</span>
            <textarea
              value={createDraft.caption}
              onChange={(e) => setCreateDraft((p) => ({ ...p, caption: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
              placeholder="My go-to long run when the weather is perfect."
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={createDraft.isPublished}
              onChange={(e) => setCreateDraft((p) => ({ ...p, isPublished: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-orange-600"
            />
            Publish now
          </label>
          <button
            type="submit"
            disabled={saving || !createDraft.name.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : createDraft.isPublished ? 'Publish route' : 'Save draft'}
          </button>
        </div>
      </form>

      <form
        onSubmit={(e) => void searchCatalog(e)}
        className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-900">Feature a route from the catalog</h4>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            placeholder="Search route name"
          />
          <input
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            placeholder="City"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50"
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 ? (
          <ul className="space-y-2">
            {searchResults.map((hit) => (
              <li
                key={hit.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{hit.name}</p>
                  <p className="text-xs text-gray-500">
                    {[hit.distanceMiles != null ? `${hit.distanceMiles} mi` : null, hit.citySlug]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void (async () => {
                      setSaving(true);
                      setError(null);
                      try {
                        await featureRoute(hit.id, { isPublished: true });
                        setSuccess('Route featured on your page.');
                      } catch (err: unknown) {
                        const e = err as { response?: { data?: { error?: string } }; message?: string };
                        setError(e.response?.data?.error || e.message || 'Could not feature route.');
                      } finally {
                        setSaving(false);
                      }
                    })()
                  }
                  className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-200 disabled:opacity-50"
                >
                  Feature
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <div className="space-y-3">
        <p className="text-xs text-gray-600">
          {publishedCount} published · {runRoutes.length - publishedCount} draft
        </p>
        {loading ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Loading routes…
          </p>
        ) : runRoutes.length > 0 ? (
          <div className="space-y-3">
            {runRoutes.map((row) => (
              <RunRouteEditorCard
                key={row.id}
                row={row}
                athleteId={athleteId}
                onSave={updateRunRoute}
                onDelete={removeRunRoute}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            No routes featured yet.
          </p>
        )}
      </div>
    </section>
  );
}

function RunRouteEditorCard({
  row,
  athleteId,
  onSave,
  onDelete,
}: {
  row: AthleteRunRoutePayload;
  athleteId: string;
  onSave: (id: string, draft: RunRouteDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<RunRouteDraft>(() => runRouteToDraft(row));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const route = row.route;
  const mapUrl = route.mapImageUrl || route.stravaMapUrl;
  const isOwnRoute = route.createdByAthleteId === athleteId;

  useEffect(() => {
    setDraft(runRouteToDraft(row));
  }, [row]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(row.id, draft);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(row.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              row.visibility === 'published'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {row.visibility}
          </span>
          <h4 className="mt-2 text-sm font-semibold text-gray-900">{route.name}</h4>
          {!isOwnRoute && route.contributorFirstName ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Catalog route by {route.contributorFirstName}
              {route.contributorHandle ? ` (@${route.contributorHandle})` : ''}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>

      {mapUrl ? (
        <img src={mapUrl} alt="" className="max-h-36 w-full rounded-lg object-cover" />
      ) : null}

      <textarea
        value={draft.caption}
        onChange={(e) => setDraft((p) => ({ ...p, caption: e.target.value }))}
        rows={2}
        className="w-full rounded-lg border border-gray-300 p-3 text-sm"
        placeholder="Your caption for this route"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.isPublished}
            onChange={(e) => setDraft((p) => ({ ...p, isPublished: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-orange-600"
          />
          Published
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </article>
  );
}
