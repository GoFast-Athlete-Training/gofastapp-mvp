'use client';

import Link from 'next/link';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  hub: ContainerHubPayload;
  handle: string;
  hostFirstName: string;
  actionLoading: boolean;
  onLeave: () => void;
};

function memberDisplayName(m: ContainerHubPayload['members'][number]): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
  if (name) return name;
  if (m.gofastHandle) return `@${m.gofastHandle}`;
  return 'Runner';
}

export default function ContainerHubCommunitySection({
  hub,
  handle,
  hostFirstName,
  actionLoading,
  onLeave,
}: Props) {
  return (
    <section id="community" className="space-y-4">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Community</h2>
        <p className="text-xs text-gray-500 mt-1">
          {hub.memberCount} runner{hub.memberCount === 1 ? '' : 's'} following {hostFirstName}.
        </p>
      </div>

      {!hub.isHost && hub.canAccessFeed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-emerald-900 font-medium">
            You&apos;re following {hostFirstName}
          </p>
          <button
            type="button"
            disabled={actionLoading}
            onClick={onLeave}
            className="text-sm text-gray-600 underline disabled:opacity-50"
          >
            Unfollow
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Followers</h3>
        {hub.members.length > 0 ? (
          <ul className="space-y-2">
            {hub.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-gray-900">{memberDisplayName(m)}</span>
                {m.gofastHandle ? (
                  <Link
                    href={`/u/${encodeURIComponent(m.gofastHandle)}`}
                    className="text-xs text-orange-600 hover:underline shrink-0"
                  >
                    View profile
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            {hub.isHost
              ? 'No followers yet — share your public page to grow your community.'
              : 'Be the first to follow and join the conversation in Feed.'}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chatter</h3>
        <p className="text-sm text-gray-600">
          Member conversations live in the Feed under Chatter. Switch to Feed to read and reply.
        </p>
        <Link
          href={athleteCommunityPath(handle, 'chatter')}
          className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
        >
          Open Feed — Chatter
        </Link>
      </div>

      {hub.isHost ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-800">
            Owner tools
          </h3>
          <p className="text-sm text-gray-700">
            Manage followers, send announcements, and preview the member experience from your studio.
          </p>
          <Link
            href="/gofast-with-others"
            className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Open studio — Community
          </Link>
        </div>
      ) : null}
    </section>
  );
}
