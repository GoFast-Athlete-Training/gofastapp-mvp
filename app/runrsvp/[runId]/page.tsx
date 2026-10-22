'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useCityRunEntryRedirect } from '@/components/runs/useCityRunEntryRedirect';

/** Legacy alias — door = public slice; hub = members only. */
function RunRsvpRedirectContent() {
  const params = useParams();
  const runId = params.runId as string;
  useCityRunEntryRedirect(runId);

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
