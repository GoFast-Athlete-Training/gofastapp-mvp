'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';

export default function RunCrewPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">RunCrew</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Join a Crew</h2>
            <p className="text-gray-600 mb-4">
              Join an existing RunCrew using a join code.
            </p>
            <button
              onClick={() => router.push('/runcrew/join')}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Join Crew
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Create a Crew</h2>
            <p className="text-gray-600 mb-4">
              Start your own RunCrew and invite others to join.
            </p>
            <button
              onClick={() => router.push('/runcrew/create')}
              className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Crew
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

