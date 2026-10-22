'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { cityRunTogetherPath } from '@/lib/city-run/run-nav-paths';

/** Legacy / alias URL — canonical public hub is /cityruntogether/{slug}. */
function RunRsvpRedirectContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = params.runId as string;

  useEffect(() => {
    if (!runId) return;
    const qs = searchParams.toString();
    router.replace(`${cityRunTogetherPath(runId)}${qs ? `?${qs}` : ''}`);
  }, [runId, searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );
}

export default function RunRsvpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <RunRsvpRedirectContent />
    </Suspense>
  );
}
