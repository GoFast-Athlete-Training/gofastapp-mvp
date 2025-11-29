'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<any>(null);
  const [crews, setCrews] = useState<any[]>([]);
  const [primaryCrew, setPrimaryCrew] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // GLOBAL RULE: Never hydrate without a Firebase user
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ HOME: No Firebase user found → redirecting to athlete-welcome');
      router.replace('/athlete-welcome');
      return;
    }

    // Step 1: Load from cache first
    const storedAthlete = LocalStorageAPI.getAthlete();
    const storedCrews = LocalStorageAPI.getCrews();

    // Optional safety: If hydration is missing or athlete not found in localStorage
    if (!storedAthlete) {
      console.log('❌ HOME: No athlete in localStorage → redirecting to athlete-welcome');
      router.push('/athlete-welcome');
      return;
    }

    console.log('✅ HOME: Athlete found in localStorage');
    setAthlete(storedAthlete);
    setCrews(storedCrews || []);

    // Step 2: Only after cache is loaded, perform runcrew hydration (if needed)
    if (storedCrews && storedCrews.length > 0) {
      const firstCrew = storedCrews[0];
      console.log('🚀 HOME: Hydrating primary crew:', firstCrew.id, firstCrew.name);
      hydrateCrew(firstCrew.id, user);
    } else {
      console.log('⚠️ HOME: No crews found, skipping crew hydration');
      setLoading(false);
    }
  }, [router]);

  const hydrateCrew = async (runCrewId: string, user: any) => {
    // GLOBAL RULE: Never hydrate without a Firebase user
    if (!user) {
      console.error('❌ HOME: Cannot hydrate crew - no Firebase user');
      setLoading(false);
      return;
    }

    try {
      // Token is automatically injected by Axios interceptor - no need to pass manually
      console.log('🚀 HOME: Calling runcrew/hydrate for:', runCrewId);
      const response = await api.post('/runcrew/hydrate', { runCrewId });
      
      console.log('📡 HOME: RunCrew hydration response:', response.status);
      
      if (response.data.success) {
        const crew = response.data.runCrew;
        console.log('✅ HOME: RunCrew hydrated successfully:', crew.name);
        LocalStorageAPI.setPrimaryCrew(crew);
        setPrimaryCrew(crew);
      } else {
        console.warn('⚠️ HOME: RunCrew hydration returned success: false');
        // Don't block UI - show warning but continue
        setError(response.data.error || 'Could not load crew data');
      }
    } catch (error: any) {
      console.error('❌ HOME: RunCrew hydration error:', error);
      // GLOBAL RULE: Never auto-redirect on hydration error
      // Show error but don't block the UI
      if (error?.response?.status === 401) {
        // 401 means unauthorized - redirect to signup
        console.log('🚫 HOME: Unauthorized (401) → redirecting to signup');
        router.replace('/signup');
        return;
      } else {
        // All other errors - show warning but continue
        setError(error?.response?.data?.error || 'Could not load crew data');
      }
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

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">⚠️ {error}</p>
          </div>
        )}

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
