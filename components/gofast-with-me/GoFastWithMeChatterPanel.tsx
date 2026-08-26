'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import {
  athleteCommunityPath,
} from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeChatterPanel({ athleteId, publicSlug }: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const communityPath = athleteCommunityPath(publicSlug, 'chatter');
  const chatterMessages = hub?.messages.filter((m) => m.topic === 'chatter') ?? [];

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        setHub(res.data.hub as ContainerHubPayload);
      } else {
        throw new Error(res.data?.error || 'Could not load chatter');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load chatter');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  return (
    <section id="chatter" className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Chatter</h2>
          <p className="text-sm text-gray-600 mt-1">
            Follower conversation on your public community — review and moderate posts.
          </p>
        </div>
        <Link
          href={communityPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 shrink-0"
        >
          Open Chatter on public community
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : chatterMessages.length > 0 ? (
          <ul className="space-y-2">
            {chatterMessages.slice(0, 10).map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <p className="text-gray-800 whitespace-pre-wrap">{m.body}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No Chatter yet — followers can start the conversation.</p>
        )}
      </div>
    </section>
  );
}
