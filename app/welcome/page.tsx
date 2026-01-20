'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';

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
 * Welcome Page - Front Door Handler
 * 
 * Purpose: Hydrate athlete data and show RunCrew selector UI
 * Behavior:
 * - Wait for Firebase auth
 * - Call /api/athlete/hydrate once
 * - Store athlete data in localStorage
 * - Show RunCrew selector UI (same as /my-runcrews) with "Welcome back" message
 * - If no crews, redirect to discovery
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runCrewCards, setRunCrewCards] = useState<RunCrewCard[]>([]);
  const [athlete, setAthlete] = useState<any>(null);

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

      // Check if already hydrated (user navigating directly to /welcome)
      if (typeof window !== 'undefined') {
        const existingModel = LocalStorageAPI.getFullHydrationModel();
        if (existingModel?.athlete) {
          // Already hydrated - show selector UI directly
          console.log('✅ Welcome: Already hydrated, showing selector UI');
          setAthlete(existingModel.athlete);
          
          // Build RunCrew cards from memberships
          const memberships = existingModel.athlete.runCrewMemberships || [];
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
          
          // If no crews exist, redirect to discovery
          if (cards.length === 0) {
            router.replace('/runcrew-discovery');
            return;
          }
          
          setIsLoading(false);
          return;
        }
      }

      // Mark as processing immediately to prevent re-runs
      hasProcessedRef.current = true;

      try {
        // Call hydrate endpoint once (Firebase token automatically added by api interceptor)
        const response = await api.post('/athlete/hydrate');
        
        if (response.data?.success && response.data?.athlete) {
          const athleteData = response.data.athlete;
          
          // Store full hydration model
          LocalStorageAPI.setFullHydrationModel({
            athlete: athleteData,
            weeklyActivities: athleteData.weeklyActivities || [],
            weeklyTotals: athleteData.weeklyTotals || null,
          });

          // Store Garmin connection status if available
          if (athleteData.garminConnected !== undefined) {
            localStorage.setItem('garminConnected', String(athleteData.garminConnected));
          }

          console.log('✅ Welcome: Athlete hydrated successfully, showing selector UI');
          
          // Set athlete state
          setAthlete(athleteData);
          
          // Build RunCrew cards from memberships
          const memberships = athleteData.runCrewMemberships || [];
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
          
          // If no crews exist, redirect to discovery
          if (cards.length === 0) {
            router.replace('/runcrew-discovery');
            return;
          }
          
          setIsLoading(false);
        } else {
          console.error('❌ Welcome: Invalid response from hydrate');
          setError('Failed to load athlete data');
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Welcome: Hydrate failed:', error?.response?.status || error?.message);
        
        // 404 = athlete not found (deleted user but still has Firebase ID) - try create route
        if (error?.response?.status === 404) {
          console.log('⚠️ Welcome: Athlete not found (404), trying create route...');
          try {
            const createRes = await api.post('/athlete/create', {});
            if (createRes.data?.success && createRes.data?.athleteId) {
              console.log('✅ Welcome: Athlete created successfully, redirecting to profile creation');
              
              // CRITICAL: Clear ALL stale athlete data from localStorage FIRST before storing new data
              // This ensures profile creation page starts fresh and doesn't pre-fill with old/deleted profile data
              localStorage.removeItem('athlete');
              localStorage.removeItem('athleteProfile');
              localStorage.removeItem('fullHydrationModel');
              localStorage.removeItem('weeklyActivities');
              localStorage.removeItem('weeklyTotals');
              
              // Store basic auth data only
              localStorage.setItem('firebaseId', firebaseUser.uid);
              localStorage.setItem('athleteId', createRes.data.athleteId);
              localStorage.setItem('email', createRes.data.data?.email || firebaseUser.email || '');
              
              // Redirect to profile creation since this is a new/recreated athlete
              // DON'T store athlete data - let user fill out the form fresh
              router.replace('/athlete-create-profile');
              return;
            } else {
              throw new Error('Create route did not return valid athlete data');
            }
          } catch (createErr: any) {
            console.error('❌ Welcome: Create route also failed:', createErr?.response?.status || createErr?.message);
            // If create also fails, redirect to signup to start fresh
            router.replace('/signup');
            return;
          }
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
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Welcome back</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your RunCrews...</p>
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

  // Show RunCrew selector UI (same as my-runcrews but with "Welcome back" message)
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome back{athlete?.firstName ? `, ${athlete.firstName}` : ''}!
          </h1>
          <p className="text-white text-xl opacity-90">
            Which RunCrew do you want to check on?
          </p>
        </div>

        {runCrewCards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">No RunCrews Yet</h2>
            <p className="text-xl text-gray-600 mb-8">
              It looks like you don't have any crews yet. Head over to our RunCrew directory to explore and find your crew.
            </p>
            <Link
              href="/runcrew-discovery"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl"
            >
              Explore RunCrews
            </Link>
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
                      {crew.role === 'manager' && (
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded">
                          Manager
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

        {/* Action Options */}
        <div className="mt-12 text-center space-x-4">
          <Link
            href="/runcrew-discovery"
            className="inline-block bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
          >
            Explore RunCrews
          </Link>
          <Link
            href="/runcrew/create"
            className="inline-block bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
          >
            + Create RunCrew
          </Link>
        </div>
      </div>
    </div>
  );
}
