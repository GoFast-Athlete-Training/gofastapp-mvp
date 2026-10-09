'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMeFeedPanel from '@/components/gofast-with-me/GoFastWithMeFeedPanel';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeCommunityPanel({ athleteId, publicSlug }: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <section id="community" className="space-y-6 pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Community workspace</h2>
        <p className="text-sm text-gray-600 mt-1">
          Post a quick daily log — it spills into the member feed.
        </p>
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
        hub={hub}
        hubLoading={loading}
        onHubRefresh={loadHub}
      />
    </section>
  );
}
