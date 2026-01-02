'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Welcome Page - Simplified
 * 
 * Purpose: Hydrate athlete data and store in localStorage
 * Behavior:
 * - Wait for Firebase auth
 * - Call /api/athlete/hydrate once
 * - Store athlete data in localStorage
 * - Show "Let's Train" button (no auto-redirect)
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
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

  const handleLetsTrain = () => {
    router.push('/athlete-home');
  };

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
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 animate-pulse">
          Let's Go <span className="text-orange-400">Crush</span> Goals!
        </h1>
        <p className="text-2xl md:text-3xl text-sky-100 font-medium mb-8">
          Start your running journey
        </p>
        
        {isHydrated && (
          <div className="mt-8">
            <button
              onClick={handleLetsTrain}
              className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-12 py-4 rounded-xl font-bold text-2xl hover:from-orange-700 hover:to-orange-600 transition shadow-2xl transform hover:scale-105"
            >
              Let's Train! →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
