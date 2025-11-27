'use client';

export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';

export default function ActivityDetailPage() {
  const params = useParams();
  const activityId = params.id as string;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Activity Details</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Activity ID: {activityId}</p>
          <p className="text-sm text-gray-400 mt-2">
            Activity detail view coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

