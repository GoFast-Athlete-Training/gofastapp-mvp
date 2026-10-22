'use client';

import { useParams } from 'next/navigation';
import { useCityRunEntryRedirect } from '@/components/runs/useCityRunEntryRedirect';

/** Legacy slug under /gorun — door if logged out; hub only when joined. */
export default function GoRunSlugRedirectPage() {
  const params = useParams();
  const runId = params.runId as string;
  useCityRunEntryRedirect(runId);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );
}
