'use client';

import Link from 'next/link';
import MemberDetailCard from '@/components/RunCrew/MemberDetailCard';
import { LocalStorageAPI } from '@/lib/localstorage';
import { athletePublicLandingUrl } from '@/lib/gofast-with-me/athlete-community-routes';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  hub: ContainerHubPayload;
  handle: string;
  /** Compact chips (aside) vs full RunCrew-style member cards (People tab). */
  variant?: 'compact' | 'hub';
};

function memberDisplayName(m: ContainerHubPayload['members'][number]): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
  if (name) return name;
  if (m.gofastHandle) return `@${m.gofastHandle}`;
  return 'Follower';
}

export default function GoFastWithMeFollowersSection({
  hub,
  handle,
  variant = 'compact',
}: Props) {
  const currentUserId = LocalStorageAPI.getAthleteId() ?? undefined;

  if (variant === 'hub') {
    return (
      <section id="followers" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">People</h2>
          <p className="text-sm text-gray-500 mt-1">
            {hub.memberCount === 0
              ? 'No followers yet.'
              : `${hub.memberCount} runner${hub.memberCount === 1 ? '' : 's'} following this GoFast With Me hub`}
          </p>
        </div>

        {hub.members.length === 0 ? (
          <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
            {hub.isHost
              ? 'Share your GoFast With Me link so others can follow your journey.'
              : 'Be among the first to follow along.'}
          </p>
        ) : (
          <div className="space-y-3">
            {hub.members.map((m) => (
              <MemberDetailCard
                key={m.id}
                member={{
                  id: m.id,
                  athleteId: m.id,
                  role: 'member',
                  athlete: {
                    id: m.id,
                    firstName: m.firstName,
                    lastName: m.lastName,
                    gofastHandle: m.gofastHandle,
                    photoURL: m.photoURL,
                    bio: null,
                  },
                  joinedAt: m.joinedAt,
                }}
                showRole={false}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        {hub.isHost ? (
          <Link
            href="/gofast-with-others"
            className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
          >
            Manage in GoFast With Me studio →
          </Link>
        ) : (
          <a
            href={athletePublicLandingUrl(handle)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
          >
            View public page →
          </a>
        )}
      </section>
    );
  }

  return (
    <section id="followers" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Followers</h2>
        <p className="text-xs text-gray-500 mt-1">
          {hub.memberCount} runner{hub.memberCount === 1 ? '' : 's'} following this GoFast With Me
          hub.
        </p>
      </div>
      {hub.members.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {hub.members.map((m) => (
            <li
              key={m.id}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-800"
            >
              {memberDisplayName(m)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          {hub.isHost
            ? 'Share your GoFast With Me link so others can follow your journey.'
            : 'Be among the first to follow along.'}
        </p>
      )}
      {hub.isHost ? (
        <Link
          href="/gofast-with-others"
          className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
        >
          Manage in GoFast With Me studio →
        </Link>
      ) : (
        <a
          href={athletePublicLandingUrl(handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
        >
          View public page →
        </a>
      )}
    </section>
  );
}
