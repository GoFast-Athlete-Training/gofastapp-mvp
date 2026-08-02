import { Suspense } from 'react';
import AthleteCommunityView from '@/components/gofast-with-me/AthleteCommunityView';

type Props = {
  params: Promise<{ handle: string }>;
};

function CommunityLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading hub…</p>
      </div>
    </div>
  );
}

export default async function AthleteCommunityPage({ params }: Props) {
  const { handle } = await params;
  return (
    <Suspense fallback={<CommunityLoading />}>
      <AthleteCommunityView handle={handle?.trim() || ''} />
    </Suspense>
  );
}
