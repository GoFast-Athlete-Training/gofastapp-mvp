'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Welcome Page - Hydration only, then athlete-home
 *
 * Flow: Wait for auth → hydrate athlete (resolve memberships) → store in localStorage → redirect to athlete-home.
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // Always re-hydrate on /welcome page to get fresh data
      // This ensures we have the latest memberships, especially after joining new crews
      console.log('🔄 Welcome: Always re-hydrating to get fresh membership data');

      // Mark as processing immediately to prevent re-runs
      hasProcessedRef.current = true;

      try {
        // Get token explicitly — don't rely on interceptor timing
        const token = await firebaseUser.getIdToken();
        const response = await api.post('/athlete/hydrate', {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
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

          // Hydrate done, memberships resolved — send to athlete-home
          router.replace('/athlete-home');
          return;
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
            router.replace('/signup');
            return;
          }
        } else if (error?.response?.status === 401) {
          // 401 here means the token didn't work — don't redirect to /signup
          // (that creates a /welcome ↔ /signup loop). Show error instead.
          setError('Authentication error. Please sign out and sign in again.');
          setIsLoading(false);
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
          <p className="text-white text-lg">Loading...</p>
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
            onClick={() => router.replace('/signup')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  // Success path redirects; only loading or error reach here
  return null;
}
