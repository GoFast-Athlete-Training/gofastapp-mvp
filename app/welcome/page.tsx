'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef } from 'react';
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
 * - Redirect to /athlete/[athleteId]
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);

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
        // Call hydrate endpoint once
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

          const athleteId = athlete.id || athlete.athleteId;
          if (athleteId) {
            console.log('✅ Welcome: Athlete hydrated, redirecting to:', `/athlete/${athleteId}`);
            router.replace(`/athlete/${athleteId}`);
          } else {
            console.error('❌ Welcome: No athleteId in response');
            router.replace('/signup');
          }
        } else {
          console.error('❌ Welcome: Invalid response from hydrate');
          router.replace('/signup');
        }
      } catch (error: any) {
        console.error('❌ Welcome: Hydrate failed:', error?.response?.status || error?.message);
        
        // 404 = athlete not found, redirect to signup
        if (error?.response?.status === 404) {
          router.replace('/signup');
        } else if (error?.response?.status === 401) {
          // 401 = unauthorized, redirect to signup
          router.replace('/signup');
        } else {
          // Other errors, redirect to signup
          router.replace('/signup');
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Show loading state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
