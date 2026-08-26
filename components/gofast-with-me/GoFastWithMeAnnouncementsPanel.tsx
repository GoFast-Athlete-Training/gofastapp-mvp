'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';

type Props = {
  athleteId: string;
};

export default function GoFastWithMeAnnouncementsPanel({ athleteId }: Props) {
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
        throw new Error(res.data?.error || 'Could not load announcements');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load announcements');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  return (
    <section id="announcements" className="space-y-6 pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
        <p className="text-sm text-gray-600 mt-1">
          Journey updates followers see in your community — post and review what&apos;s live.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : hub ? (
        <GoFastWithMeHubFeed
          hostId={athleteId}
          isHost
          canAccessFeed
          upcomingRuns={hub.upcomingRuns}
          publishedPlan={hub.publishedPlan}
          initialMessages={hub.messages.filter((m) => m.topic === 'updates')}
          announcementsMode
          showHeading={false}
        />
      ) : null}
    </section>
  );
}
