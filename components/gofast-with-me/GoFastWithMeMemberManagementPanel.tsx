'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Users } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeMemberManagementPanel({ athleteId, publicSlug }: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hubPath = `/container/${encodeURIComponent(publicSlug)}#followers`;

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        setHub(res.data.hub as ContainerHubPayload);
      } else {
        throw new Error(res.data?.error || 'Could not load member hub');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load member hub');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  return (
    <section id="followers" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Followers</h2>
        <p className="text-sm text-gray-600 mt-1">
          Runners following your GoFast With Me hub — they see your goal, plan strip, and journey
          messages after they follow.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Follower list</h3>
              {loading ? (
                <p className="text-xs text-gray-500 mt-1">Loading…</p>
              ) : (
                <p className="text-xs text-gray-600 mt-1">
                  {hub?.memberCount ?? 0} follower{(hub?.memberCount ?? 0) === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
          <Link
            href={hubPath}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
          >
            View as member
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!loading && hub && hub.members.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {hub.members.map((m) => (
              <li
                key={m.id}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-800"
              >
                {[m.firstName, m.lastName].filter(Boolean).join(' ') ||
                  m.gofastHandle ||
                  'Follower'}
              </li>
            ))}
          </ul>
        ) : !loading ? (
          <p className="text-sm text-gray-500">No followers yet — share your public page to grow.</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Member hub</h3>
        <p className="text-xs text-gray-600 mt-1">
          Preview what followers see — What I&apos;m training for, plan strip, messages, and follower
          list in one scroll.
        </p>
        <Link
          href={hubPath}
          className="mt-3 inline-flex rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
        >
          View as member — GoFast With Me hub
        </Link>
      </div>
    </section>
  );
}
