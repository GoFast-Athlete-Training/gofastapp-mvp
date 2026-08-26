import { Suspense } from 'react';
import GoFastWithOthersDashboard from '@/components/gofast-with-me/GoFastWithOthersDashboard';

export const dynamic = 'force-dynamic';

export default function GoFastWithOthersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading studio…</div>}>
      <GoFastWithOthersDashboard />
    </Suspense>
  );
}
