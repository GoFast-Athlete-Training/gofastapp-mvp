'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Welcome Page - PHASE 1
 * 
 * Purpose: Bootstrap identity and store in localStorage
 * Behavior:
 * - Hydrate athlete (or create if doesn't exist)
 * - Store athleteId in localStorage
 * - Redirect to /athlete/[athleteId]
 */
export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Not authenticated - redirect to signup
        router.replace('/signup');
        return;
      }

      try {
        // Ensure athlete exists - try hydrate first (athlete might already exist)
        let athleteId: string | null = null;
        try {
          const hydrateResponse = await api.post('/athlete/hydrate');
          athleteId = hydrateResponse.data?.athlete?.id || hydrateResponse.data?.athleteId;
        } catch (hydrateError: any) {
          // If hydrate fails (404), try create
          if (hydrateError?.response?.status === 404) {
            const createResponse = await api.post('/athlete/create', {});
            athleteId = createResponse.data?.athleteId || createResponse.data?.data?.id;
          } else {
            throw hydrateError;
          }
        }

        // Store athleteId in localStorage (pattern: use this for all API calls)
        if (athleteId) {
          LocalStorageAPI.setAthleteId(athleteId);
          console.log('✅ Welcome: Stored athleteId in localStorage:', athleteId);
          router.replace(`/athlete/${athleteId}`);
        } else {
          console.error('❌ Welcome: No athleteId in response');
          router.replace('/signup');
        }
      } catch (error: any) {
        console.error('❌ Welcome: Failed to bootstrap identity:', error);
        router.replace('/signup');
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

