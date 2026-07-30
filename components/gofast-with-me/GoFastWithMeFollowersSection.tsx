'use client';

import Link from 'next/link';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  hub: ContainerHubPayload;
  handle: string;
};

function memberDisplayName(m: ContainerHubPayload['members'][number]): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
  if (name) return name;
  if (m.gofastHandle) return `@${m.gofastHandle}`;
  return 'Follower';
}

export default function GoFastWithMeFollowersSection({ hub, handle }: Props) {
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
        <Link
          href={`/u/${encodeURIComponent(handle)}`}
          className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
        >
          View public page →
        </Link>
      )}
    </section>
  );
}
