'use client';

import Link from 'next/link';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import AthleteCommunityUpdatesSection from '@/components/gofast-with-me/AthleteCommunityUpdatesSection';

type Props = {
  hostId: string;
  isHost: boolean;
  canAccessFeed: boolean;
  hub: ContainerHubPayload;
};

/** Follower-facing weekly announcements — first-class rows, not chatter topics. */
export default function GoFastWithMeHubMessagesSection({ isHost, hub }: Props) {
  const firstName = hub.host.firstName?.trim() || 'Host';

  return (
    <section id="messages" className="space-y-2">
      <AthleteCommunityUpdatesSection
        announcements={hub.announcements ?? []}
        hostFirstName={firstName}
        isOwner={isHost}
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
