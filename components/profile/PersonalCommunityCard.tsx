'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  athleteId: string;
  gofastHandle: string | null;
  compact?: boolean;
};

export default function PersonalCommunityCard({
  athleteId,
  gofastHandle,
  compact = false,
}: Props) {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!athleteId || !gofastHandle?.trim()) {
      setMemberCount(0);
      return;
    }
    api
      .get(`/athlete/public/${encodeURIComponent(gofastHandle.trim())}/community`)
      .then((r) => setMemberCount(r.data?.community?.memberCount ?? 0))
      .catch(() => {});
  }, [athleteId, gofastHandle]);

  if (!gofastHandle?.trim()) {
    return null;
  }

  const wrapperClass = compact
    ? 'rounded-xl border border-violet-200/80 bg-violet-50/50 p-4'
    : 'rounded-2xl border border-violet-200 bg-violet-50/40 p-5 sm:p-6 shadow-sm';

  return (
    <section className={wrapperClass}>
      <h2 className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>
        Your running community
      </h2>
      <p className={`text-gray-600 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
        Runners who follow you can chat and see shared activity on your community page.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-violet-900">{memberCount}</span> follower
          {memberCount !== 1 ? 's' : ''}
        </p>
        <Link
          href={athleteCommunityPath(gofastHandle)}
          className="inline-flex items-center rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
        >
          Open community
        </Link>
      </div>
    </section>
  );
}
