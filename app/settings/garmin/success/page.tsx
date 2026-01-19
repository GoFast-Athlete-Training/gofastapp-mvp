'use client';


import { useRouter } from 'next/navigation';

export default function GarminSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Garmin Connected Successfully!
          </h1>
          <p className="text-gray-600 mb-6">
            Your Garmin account has been connected. Your activities will now sync automatically.
          </p>
          <button
            onClick={() => router.push('/settings')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Settings
          </button>
        </div>
      </div>
    </div>
  );
}

