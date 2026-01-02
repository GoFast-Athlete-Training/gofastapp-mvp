'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef } from 'react';
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
  const isProcessingRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple simultaneous executions
    if (isProcessingRef.current || hasRedirectedRef.current) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Prevent processing if already redirected
      if (hasRedirectedRef.current) {
        return;
      }

      // Prevent multiple simultaneous calls
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      if (!firebaseUser) {
        // Not authenticated - redirect to signup
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          router.replace('/signup');
        }
        isProcessingRef.current = false;
        return;
      }

      try {
        // Ensure athlete exists - try hydrate first (athlete might already exist)
        let athleteId: string | null = null;
        try {
          // Add timeout to prevent hanging
          const hydrateResponse = await Promise.race([
            api.post('/athlete/hydrate'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Hydrate request timeout')), 10000)
            )
          ]) as any;
          athleteId = hydrateResponse.data?.athlete?.id || hydrateResponse.data?.athleteId;
        } catch (hydrateError: any) {
          console.log('⚠️ Welcome: Hydrate failed, trying create:', hydrateError?.response?.status || hydrateError?.message);
          // If hydrate fails (404), try create
          if (hydrateError?.response?.status === 404 || hydrateError?.message?.includes('timeout')) {
            try {
              // Add timeout to create request as well
              const createResponse = await Promise.race([
                api.post('/athlete/create', {}),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Create request timeout')), 10000)
                )
              ]) as any;
              athleteId = createResponse.data?.athleteId || createResponse.data?.data?.id;
            } catch (createError: any) {
              console.error('❌ Welcome: Create also failed:', createError?.response?.status || createError?.message);
              throw createError;
            }
          } else {
            throw hydrateError;
          }
        }

        // Store athleteId in localStorage (pattern: use this for all API calls)
        if (athleteId) {
          LocalStorageAPI.setAthleteId(athleteId);
          console.log('✅ Welcome: Stored athleteId in localStorage:', athleteId);
          
          // Mark as redirected before navigation
          hasRedirectedRef.current = true;
          
          // Use replace with force refresh if needed
          const redirectPath = `/athlete/${athleteId}`;
          console.log('🔄 Welcome: Redirecting to:', redirectPath);
          router.replace(redirectPath);
          
          // Force navigation if replace doesn't work immediately
          setTimeout(() => {
            if (window.location.pathname === '/welcome') {
              window.location.href = redirectPath;
            }
          }, 100);
        } else {
          console.error('❌ Welcome: No athleteId in response');
          hasRedirectedRef.current = true;
          router.replace('/signup');
        }
      } catch (error: any) {
        console.error('❌ Welcome: Failed to bootstrap identity:', error);
        console.error('❌ Welcome: Error details:', {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data
        });
        hasRedirectedRef.current = true;
        router.replace('/signup');
      } finally {
        isProcessingRef.current = false;
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

