'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Route } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  athleteId: string;
  publicSlug: string;
  /** Compact block for Runs & Training — no page header or plan footer. */
  embedded?: boolean;
  /** Show host-without-plan links when there is no active plan week picker. */
  showNoPlanFallback?: boolean;
};

export default function GoFastWithMeRunsPanel({
  athleteId,
  publicSlug,
  embedded = false,
  showNoPlanFallback = false,
}: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hubRunsPath = athleteCommunityPath(publicSlug, 'goruns');

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        setHub(res.data.hub as ContainerHubPayload);
      } else {
        throw new Error(res.data?.error || 'Could not load runs');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load runs');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  const runs = hub?.upcomingRuns ?? [];

  return (
    <section id="runs" className={embedded ? 'space-y-4' : 'space-y-8'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Runs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Host joinable runs for your audience. Followers RSVP through GoRun — no separate RSVP
            system in the container.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Route className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Hosted runs</h3>
              <p className="text-xs text-gray-600 mt-1">
                Public runs you host appear in your member hub Runs tab and can be attached to Feed
                posts.
              </p>
            </div>
          </div>
          <Link
            href={hubRunsPath}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50"
          >
            View as member
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading upcoming runs…</p>
        ) : runs.length > 0 ? (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.gorunPath.startsWith('/') ? r.gorunPath : `/${r.gorunPath}`}
                  className="block rounded-xl border border-gray-200 bg-white p-3 text-sm hover:border-orange-300 transition"
                >
                  <span className="font-medium text-gray-900">{r.title}</span>
                  <span className="block text-gray-500 mt-1">
                    {new Date(r.date).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {r.meetUpPoint ? ` · ${r.meetUpPoint}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 rounded-lg border border-dashed border-orange-200 bg-white/60 p-4">
            {showNoPlanFallback
              ? 'No upcoming hosted runs yet. Host without a plan below, or pick a workout from your plan above.'
              : 'No upcoming hosted runs yet. Pick a workout above to invite followers — e.g. a Saturday long run.'}
          </p>
        )}

        {showNoPlanFallback ? (
          <p className="text-xs text-gray-500 pt-1 border-t border-orange-100">
            No plan this week?{' '}
            <Link href="/host-a-run" className="font-semibold text-orange-700 hover:underline">
              Host a public run
            </Link>
            {' · '}
            <Link href="/build-a-run" className="font-semibold text-gray-700 hover:underline">
              Build a run
            </Link>
          </p>
        ) : null}
      </div>

      {!embedded ? (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Training plan (optional)</h3>
            <p className="text-xs text-gray-600 mt-1">
              Publish your active plan so followers can train alongside you — secondary to hosted
              runs.
            </p>
          </div>
        </div>
        <Link
          href="/training-setup"
          className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100"
        >
          Open My Training
        </Link>
      </div>
      ) : null}
    </section>
  );
}
