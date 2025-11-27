'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';

export default function RunCrewSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Success!
          </h1>
          <p className="text-gray-600 mb-6">
            Your RunCrew action was successful.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

