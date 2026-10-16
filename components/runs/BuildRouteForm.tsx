'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import api from '@/lib/api';
import CityRunRoutePhotosField from '@/components/cityruns/CityRunRoutePhotosField';
import CityRunRouteMapUploadField from '@/components/cityruns/CityRunRouteMapUploadField';

type Props = {
  onSaved?: (routeId: string) => void;
  className?: string;
  /** When set, hide post-save navigation (parent handles attach). */
  embedded?: boolean;
  /** Prefill from city run create (step 2). */
  defaultRouteNeighborhood?: string | null;
};

export default function BuildRouteForm({
  onSaved,
  className = '',
  embedded = false,
  defaultRouteNeighborhood = null,
}: Props) {
  const [name, setName] = useState('');
  const [stravaUrl, setStravaUrl] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [routeNeighborhood, setRouteNeighborhood] = useState(
    () => defaultRouteNeighborhood?.trim() || ''
  );
  const [routeDescription, setRouteDescription] = useState('');
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [routePhotos, setRoutePhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !stravaUrl.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const miles = parseFloat(distanceMiles);
      const res = await api.post('/routes', {
        name: name.trim(),
        stravaUrl: stravaUrl.trim(),
        distanceMiles: Number.isFinite(miles) && miles > 0 ? miles : undefined,
        routeNeighborhood: routeNeighborhood.trim() || undefined,
        routeDescription: routeDescription.trim() || undefined,
        mapImageUrl: mapImageUrl.trim() || undefined,
        routePhotos: routePhotos.length > 0 ? routePhotos : undefined,
      });
      const id = res.data?.route?.id as string | undefined;
      if (!id) throw new Error('Could not save route');
      setSavedId(id);
      onSaved?.(id);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e2.response?.data?.error || e2.message || 'Could not save route.');
    } finally {
      setBusy(false);
    }
  };

  if (savedId && embedded) {
    return (
      <p className="text-sm text-emerald-800 flex items-center gap-2">
        Route saved — attaching to your invite…
      </p>
    );
  }

  if (savedId) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-6 ${className}`}>
        <p className="text-sm font-semibold text-emerald-900">Route saved.</p>
        <p className="text-sm text-emerald-800 mt-2">
          Use it when you create a run, or search for it from Find a route.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/host-a-run?routeId=${encodeURIComponent(savedId)}`}
            className="inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Create a run with this route
          </Link>
          <Link
            href="/build-a-run/discover"
            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Find a route
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-start gap-2">
        <MapPin className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Build a route</h2>
          <p className="text-sm text-gray-600 mt-1">
            Save a path you can reuse on run invites. Give it a name you will recognize later.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Route name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Teddy Friday loop"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Strava route URL</span>
        <input
          type="url"
          value={stravaUrl}
          onChange={(e) => setStravaUrl(e.target.value)}
          placeholder="https://www.strava.com/routes/…"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          required
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Miles (optional)</span>
          <input
            type="number"
            step={0.1}
            min={0}
            value={distanceMiles}
            onChange={(e) => setDistanceMiles(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Route neighborhood</span>
          <input
            value={routeNeighborhood}
            onChange={(e) => setRouteNeighborhood(e.target.value)}
            placeholder="e.g. Fletcher's Cove, Carderock"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-gray-500">Optional — matches the run invite when attached.</span>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-gray-700">Route description</span>
        <textarea
          value={routeDescription}
          onChange={(e) => setRouteDescription(e.target.value)}
          rows={4}
          placeholder="Turn-by-turn notes or what runners should expect on this path…"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Optional — same field staff use as route description; shows on the invite when attached.
        </span>
      </label>

      <CityRunRouteMapUploadField mapImageUrl={mapImageUrl} onChange={setMapImageUrl} onError={setError} />
      <CityRunRoutePhotosField photos={routePhotos} onChange={setRoutePhotos} onError={setError} />

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !name.trim() || !stravaUrl.trim()}
        className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save route'}
      </button>
    </form>
  );
}
