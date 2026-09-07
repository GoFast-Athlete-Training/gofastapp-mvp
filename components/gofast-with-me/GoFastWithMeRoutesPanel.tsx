'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';

type Props = {
  athleteId: string;
};

type RouteCreateDraft = {
  name: string;
  whyFavorite: string;
  description: string;
  stravaUrl: string;
  isPublished: boolean;
};

type RunRouteDraft = {
  whyFavorite: string;
  description: string;
  isPublished: boolean;
};

const EMPTY_CREATE: RouteCreateDraft = {
  name: '',
  whyFavorite: '',
  description: '',
  stravaUrl: '',
  isPublished: true,
};

function runRouteToDraft(row: AthleteRunRoutePayload): RunRouteDraft {
  return {
    whyFavorite: row.whyFavorite ?? row.caption ?? '',
    description: row.description ?? '',
    isPublished: row.visibility === 'published',
  };
}

export default function GoFastWithMeRoutesPanel({ athleteId }: Props) {
  const [runRoutes, setRunRoutes] = useState<AthleteRunRoutePayload[]>([]);
  const [createDraft, setCreateDraft] = useState<RouteCreateDraft>(EMPTY_CREATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setError(e.response?.data?.error || e.message || 'Could not load routes.');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadRunRoutes();
  }, [loadRunRoutes]);

  const createAndFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDraft.name.trim() || !createDraft.stravaUrl.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const routeRes = await api.post('/routes', {
        name: createDraft.name.trim(),
        stravaUrl: createDraft.stravaUrl.trim(),
      });
      const routeId = routeRes.data?.route?.id as string | undefined;
      if (!routeId) throw new Error('Could not create route');

      const featureRes = await api.post(`/athlete/${athleteId}/run-routes`, {
        routeId,
        whyFavorite: createDraft.whyFavorite.trim() || null,
        description: createDraft.description.trim() || null,
        sortOrder: 0,
        isPublished: createDraft.isPublished,
      });
      if (featureRes.data?.runRoute) {
        const row = featureRes.data.runRoute as AthleteRunRoutePayload;
        setRunRoutes((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
      } else {
        await loadRunRoutes();
      }

      setCreateDraft(EMPTY_CREATE);
      setSuccess(createDraft.isPublished ? 'Route published.' : 'Route saved as draft.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not save route.');
    } finally {
      setSaving(false);
    }
  };

  const updateRunRoute = async (runRouteId: string, next: RunRouteDraft) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put(`/athlete/${athleteId}/run-routes/${runRouteId}`, {
        whyFavorite: next.whyFavorite.trim() || null,
        description: next.description.trim() || null,
        sortOrder: 0,
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
    if (!confirm('Remove this route from your favorites?')) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/athlete/${athleteId}/run-routes/${runRouteId}`);
      setRunRoutes((prev) => prev.filter((r) => r.id !== runRouteId));
      setSuccess('Route removed.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not remove route.');
    }
  };

  const publishedCount = runRoutes.filter((r) => r.visibility === 'published').length;

  return (
    <section id="myrunroutes" className="space-y-4 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Routes</h2>
        <p className="text-sm text-gray-600 mt-1">
          Stuff you like — favorite routes you run and want followers to know about.
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
            <h4 className="text-sm font-semibold text-gray-900">Add a favorite route</h4>
            <p className="text-xs text-gray-600 mt-1">Name it, say why you love it, paste Strava.</p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Name</span>
          <input
            value={createDraft.name}
            onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Hains Point 5-mile loop"
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Why it&apos;s my favorite</span>
          <textarea
            value={createDraft.whyFavorite}
            onChange={(e) => setCreateDraft((p) => ({ ...p, whyFavorite: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
            placeholder="My go-to when the weather is perfect."
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Description</span>
          <textarea
            value={createDraft.description}
            onChange={(e) => setCreateDraft((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
            placeholder="Flat, shaded, great for tempo work."
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Strava URL</span>
          <input
            value={createDraft.stravaUrl}
            onChange={(e) => setCreateDraft((p) => ({ ...p, stravaUrl: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="https://www.strava.com/routes/…"
            required
          />
        </label>

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
            disabled={saving || !createDraft.name.trim() || !createDraft.stravaUrl.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : createDraft.isPublished ? 'Publish route' : 'Save draft'}
          </button>
        </div>
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
                onSave={updateRunRoute}
                onDelete={removeRunRoute}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            No favorite routes yet.
          </p>
        )}
      </div>
    </section>
  );
}

function RunRouteEditorCard({
  row,
  onSave,
  onDelete,
}: {
  row: AthleteRunRoutePayload;
  onSave: (id: string, draft: RunRouteDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<RunRouteDraft>(() => runRouteToDraft(row));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const route = row.route;
  const mapUrl = route.mapImageUrl || route.stravaMapUrl;

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
          {route.stravaUrl ? (
            <a
              href={route.stravaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-sky-700 hover:underline">
              Open on Strava
            </a>
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

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Why it&apos;s my favorite</span>
        <textarea
          value={draft.whyFavorite}
          onChange={(e) => setDraft((p) => ({ ...p, whyFavorite: e.target.value }))}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Description</span>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
        />
      </label>

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
