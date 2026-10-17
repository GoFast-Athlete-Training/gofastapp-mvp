'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { runRsvpPath } from '@/lib/city-run/run-nav-paths';

/** Legacy slug under /gorun — always send to the public RSVP page. */
export default function GoRunSlugRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  useEffect(() => {
    if (!runId) return;
    router.replace(runRsvpPath(runId));
  }, [runId, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );
}
