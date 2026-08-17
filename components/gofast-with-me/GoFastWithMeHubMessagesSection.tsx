'use client';

import Link from 'next/link';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  hostId: string;
  isHost: boolean;
  canAccessFeed: boolean;
  hub: ContainerHubPayload;
};

export default function GoFastWithMeHubMessagesSection({
  hostId,
  isHost,
  canAccessFeed,
  hub,
}: Props) {
  return (
    <section id="messages" className="space-y-2">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Daily log</h2>
        <p className="text-xs text-gray-500 mt-1">
          How you&apos;re feeling today — posts appear in the member feed.
        </p>
      </div>
      <GoFastWithMeHubFeed
        hostId={hostId}
        isHost={isHost}
        canAccessFeed={canAccessFeed}
        upcomingRuns={hub.upcomingRuns}
        publishedPlan={hub.publishedPlan}
        announcementsMode
      />
      {isHost ? (
        <p className="text-xs text-gray-500 px-1">
          Post from{' '}
          <Link href="/gofast-with-others" className="text-orange-600 font-semibold hover:underline">
            GoFast With Me studio
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
