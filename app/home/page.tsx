'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<any>(null);
  const [crews, setCrews] = useState<any[]>([]);
  const [primaryCrew, setPrimaryCrew] = useState<any>(null);

  useEffect(() => {
    // Read from localStorage
    const storedAthlete = LocalStorageAPI.getAthlete();
    const storedCrews = LocalStorageAPI.getCrews();

    if (!storedAthlete) {
      router.push('/welcome');
      return;
    }

    setAthlete(storedAthlete);
    setCrews(storedCrews || []);

    // If we have crews, hydrate the first one
    if (storedCrews && storedCrews.length > 0) {
      const firstCrew = storedCrews[0];
      hydrateCrew(firstCrew.id);
    } else {
      setLoading(false);
    }
  }, [router]);

  const hydrateCrew = async (runCrewId: string) => {
    try {
      const response = await api.post('/runcrew/hydrate', { runCrewId });
      
      if (response.data.success) {
        const crew = response.data.runCrew;
        LocalStorageAPI.setPrimaryCrew(crew);
        setPrimaryCrew(crew);
      }
    } catch (error) {
      console.error('Error hydrating crew:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Welcome back, {athlete?.firstName || 'Athlete'}!
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* RunCrew Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">RunCrew</h2>
            {crews.length > 0 ? (
              <div className="space-y-2">
                {crews.map((crew) => (
                  <button
                    key={crew.id}
                    onClick={() => router.push(`/runcrew/${crew.id}`)}
                    className="block w-full text-left p-3 border rounded hover:bg-gray-50"
                  >
                    <div className="font-medium">{crew.name}</div>
                    <div className="text-sm text-gray-500">{crew.role}</div>
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => router.push('/runcrew')}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Join or Create Crew
              </button>
            )}
          </div>

          {/* Activities Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Activities</h2>
            <button
              onClick={() => router.push('/activities')}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Activities
            </button>
          </div>

          {/* Settings Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <button
              onClick={() => router.push('/settings')}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

