'use client';

import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  memberCount: number;
  isHost: boolean;
};

export default function GoFastWithMeThinkingSection({ memberCount, isHost }: Props) {
  return (
    <section id="thinking" className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        What I&apos;m thinking about
      </h2>
      <p className="text-sm text-gray-600">
        Tips and training thoughts from the athlete — coming soon. This is your voice alongside
        the goal and plan, not schedule chatter.
      </p>
      {isHost ? (
        <p className="text-xs text-gray-500">
          You&apos;ll publish tips here from GoFast With Me studio when athlete tips are ready.
        </p>
      ) : memberCount > 0 ? (
        <p className="text-xs text-gray-500">Check back as {isHost ? 'you' : 'they'} add thoughts.</p>
      ) : null}
    </section>
  );
}
