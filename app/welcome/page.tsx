'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

interface RunCrewCard {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  icon?: string;
  role: 'admin' | 'member' | 'manager';
  membershipId: string;
}

/**
 * Welcome Page - RunCrew Selector
 * 
 * Purpose: Hydrate athlete data and display RunCrew cards
 * Behavior:
 * - Wait for Firebase auth
 * - Call /api/athlete/hydrate once
 * - Store athlete data in localStorage
 * - Display cards for each RunCrew the user is a member of
 * - Each card shows logo/icon and has buttons for "View as Member" / "View as Admin"
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runCrewCards, setRunCrewCards] = useState<RunCrewCard[]>([]);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessedRef.current) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Already processed, ignore
      if (hasProcessedRef.current) {
        return;
      }

      // No Firebase user - redirect to signup
      if (!firebaseUser) {
        hasProcessedRef.current = true;
        router.replace('/signup');
        return;
      }

      // Mark as processing immediately to prevent re-runs
      hasProcessedRef.current = true;

      try {
        // Call hydrate endpoint once (Firebase token automatically added by api interceptor)
        const response = await api.post('/athlete/hydrate');
        
        if (response.data?.success && response.data?.athlete) {
          const athlete = response.data.athlete;
          
          // Store full hydration model
          LocalStorageAPI.setFullHydrationModel({
            athlete,
            weeklyActivities: athlete.weeklyActivities || [],
            weeklyTotals: athlete.weeklyTotals || null,
          });

          // Store Garmin connection status if available
          if (athlete.garminConnected !== undefined) {
            localStorage.setItem('garminConnected', String(athlete.garminConnected));
          }

          // Build RunCrew cards from memberships
          const memberships = athlete.runCrewMemberships || [];
          const cards: RunCrewCard[] = memberships.map((membership: any) => {
            const runCrew = membership.runCrew || {};
            return {
              id: runCrew.id || membership.runCrewId,
              name: runCrew.name || 'Unknown Crew',
              description: runCrew.description,
              logo: runCrew.logo,
              icon: runCrew.icon,
              role: membership.role || 'member',
              membershipId: membership.id,
            };
          });

          setRunCrewCards(cards);
          console.log('✅ Welcome: Athlete hydrated successfully');
          setIsHydrated(true);
          setIsLoading(false);
        } else {
          console.error('❌ Welcome: Invalid response from hydrate');
          setError('Failed to load athlete data');
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Welcome: Hydrate failed:', error?.response?.status || error?.message);
        
        // 404 = athlete not found, redirect to create profile
        if (error?.response?.status === 404) {
          router.replace('/athlete-create-profile');
        } else if (error?.response?.status === 401) {
          // 401 = unauthorized, redirect to signup
          router.replace('/signup');
        } else {
          // Other errors, show error state
          setError(error?.response?.data?.error || error?.message || 'Failed to load athlete data');
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Account</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/signup')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Welcome Back
          </h1>
          <p className="text-xl text-sky-100">
            Select a RunCrew to get started
          </p>
        </div>

        {runCrewCards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No RunCrews Yet</h2>
            <p className="text-gray-600 mb-6">You're not a member of any RunCrews yet.</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/runcrew/create"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                Create RunCrew
              </Link>
              <Link
                href="/runcrew/join"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                Join RunCrew
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runCrewCards.map((crew) => (
              <div
                key={crew.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Crew Header with Logo/Icon */}
                <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                  <div className="flex items-center gap-4 mb-4">
                    {crew.logo ? (
                      <img
                        src={crew.logo}
                        alt={crew.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : crew.icon ? (
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl border-2 border-white shadow-md">
                        {crew.icon}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-3xl text-white border-2 border-white shadow-md">
                        🏃
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{crew.name}</h3>
                      {crew.role === 'admin' && (
                        <span className="inline-block mt-1 px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  {crew.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{crew.description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-6 space-y-3">
                  <Link
                    href={`/runcrew/${crew.id}/member`}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold text-center transition"
                  >
                    View as Member
                  </Link>
                  {crew.role === 'admin' || crew.role === 'manager' ? (
                    <Link
                      href={`/runcrew/${crew.id}/admin`}
                      className="block w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold text-center transition"
                    >
                      View as Admin
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Join Options */}
        {runCrewCards.length > 0 && (
          <div className="mt-12 text-center">
            <div className="inline-flex gap-4">
              <Link
                href="/runcrew/create"
                className="bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
              >
                + Create Another RunCrew
              </Link>
              <Link
                href="/runcrew/join"
                className="bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
              >
                + Join RunCrew
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
