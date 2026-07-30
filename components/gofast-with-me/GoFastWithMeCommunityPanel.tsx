'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import GoFastWithMeFeedPanel from '@/components/gofast-with-me/GoFastWithMeFeedPanel';
import GoFastWithMeMemberManagementPanel from '@/components/gofast-with-me/GoFastWithMeMemberManagementPanel';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeCommunityPanel({ athleteId, publicSlug }: Props) {
  const hubPath = `/container/${encodeURIComponent(publicSlug)}`;

  return (
    <section id="community" className="space-y-10 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Community</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your personal community — messages and followers. Publish your plan under{' '}
            <strong>My Plan</strong>. Followers see this same space at your hub link.
          </p>
        </div>
        <Link
          href={hubPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 shrink-0"
        >
          View as member
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <GoFastWithMeFeedPanel athleteId={athleteId} publicSlug={publicSlug} embedded />
      <GoFastWithMeMemberManagementPanel
        athleteId={athleteId}
        publicSlug={publicSlug}
        embedded
      />
    </section>
  );
}
