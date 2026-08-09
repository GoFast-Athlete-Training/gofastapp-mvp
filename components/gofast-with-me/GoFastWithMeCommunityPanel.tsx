'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import {
  athleteCommunityPath,
  athleteCommunityPreviewPath,
} from '@/lib/gofast-with-me/athlete-community-routes';
import GoFastWithMeFeedPanel from '@/components/gofast-with-me/GoFastWithMeFeedPanel';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeCommunityPanel({ athleteId, publicSlug }: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const communityPath = athleteCommunityPath(publicSlug);
  const previewPath = athleteCommunityPreviewPath(publicSlug);
  const chatterMessages = hub?.messages.filter((m) => m.topic === 'chatter') ?? [];

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        setHub(res.data.hub as ContainerHubPayload);
      } else {
        throw new Error(res.data?.error || 'Could not load community');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load community');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  return (
    <section id="community" className="space-y-10 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Weekly message</h2>
          <p className="text-sm text-gray-600 mt-1">
            Post first-class announcements for Journey — separate from Chatter. Follower management
            lives on Home.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href={communityPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
          >
            View public community
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={previewPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            See what followers see
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <GoFastWithMeFeedPanel
        athleteId={athleteId}
        publicSlug={publicSlug}
        embedded
        announcements={hub?.announcements}
        hubLoading={loading}
        onHubRefresh={loadHub}
      />

      <section id="chatter-review" className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chatter</h3>
          <p className="text-xs text-gray-600 mt-1">
            Follower conversation on your public community — you can remove posts there as owner.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : chatterMessages.length > 0 ? (
            <ul className="space-y-2">
              {chatterMessages.slice(0, 5).map((m) => (
                <li key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No Chatter yet.</p>
          )}
          <Link
            href={athleteCommunityPath(publicSlug, 'chatter')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
          >
            Open Chatter on public community →
          </Link>
        </div>
      </section>
    </section>
  );
}
