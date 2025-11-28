'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function AthleteWelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // GLOBAL RULE: Never hydrate without a Firebase user
      if (!user) {
        console.log('❌ ATHLETE WELCOME: No Firebase user found → redirecting to signup');
        router.replace('/signup');
        return;
      }

      try {
        console.log('🚀 ATHLETE WELCOME: ===== STARTING SETUP =====');
        setIsLoading(true);
        setError(null);
        setWarnings([]);

        // Step 1: Get ID token (required for all backend calls)
        console.log('✅ ATHLETE WELCOME: Firebase user found');
        console.log('✅ ATHLETE WELCOME: Firebase UID:', user.uid);
        console.log('✅ ATHLETE WELCOME: Firebase Email:', user.email);
        
        let token: string;
        try {
          token = await user.getIdToken();
          console.log('✅ ATHLETE WELCOME: Got Firebase token');
        } catch (tokenError: any) {
          console.error('❌ ATHLETE WELCOME: Failed to get token:', tokenError);
          setError('Failed to authenticate. Please try signing in again.');
          setIsLoading(false);
          return;
        }

        // Step 2: Create GoFastCompany (idempotent)
        // Token is automatically injected by Axios interceptor - no need to pass manually
        console.log('🚀 ATHLETE WELCOME: Step 1 - Initializing company...');
        try {
          await api.post('/company/init', {});
          console.log('✅ ATHLETE WELCOME: Company initialized');
        } catch (companyError: any) {
          console.warn('⚠️ ATHLETE WELCOME: Company init failed:', companyError?.response?.status);
          // Don't block - company might already exist
          if (companyError?.response?.status !== 401) {
            setWarnings(prev => [...prev, 'Could not initialize company (continuing anyway)']);
          }
        }

        // Step 3: Create athlete (idempotent)
        // Token is automatically injected by Axios interceptor - no need to pass manually
        console.log('🚀 ATHLETE WELCOME: Step 2 - Creating/finding athlete...');
        try {
          await api.post('/athlete/create', {
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || null,
            lastName: user.displayName?.split(' ')[1] || null,
          });
          console.log('✅ ATHLETE WELCOME: Athlete created/found');
        } catch (athleteError: any) {
          console.warn('⚠️ ATHLETE WELCOME: Athlete create failed:', athleteError?.response?.status);
          // Don't block - athlete might already exist
          if (athleteError?.response?.status !== 401) {
            setWarnings(prev => [...prev, 'Could not create athlete (continuing anyway)']);
          }
        }

        // Step 4: Hydrate athlete (read-only)
        // Token is automatically injected by Axios interceptor - no need to pass manually
        console.log('🚀 ATHLETE WELCOME: Step 3 - Hydrating athlete...');
        try {
          const response = await api.post('/athlete/hydrate', {});
          
          console.log('📡 ATHLETE WELCOME: Hydration response received:', response.status);
          
          if (response.data.success) {
            const { athlete, weeklyActivities, weeklyTotals } = response.data;

            console.log('✅ ATHLETE WELCOME: Athlete hydrated successfully');
            console.log('✅ ATHLETE WELCOME: Athlete ID:', athlete?.id);
            console.log('✅ ATHLETE WELCOME: Email:', athlete?.email);
            console.log('✅ ATHLETE WELCOME: Name:', athlete?.firstName, athlete?.lastName);
            console.log('✅ ATHLETE WELCOME: RunCrews count:', athlete?.runCrews?.length || 0);
            console.log('✅ ATHLETE WELCOME: Weekly activities count:', weeklyActivities?.length || 0);

            // Store the complete Prisma model
            console.log('💾 ATHLETE WELCOME: Caching full hydration model to localStorage...');
            LocalStorageAPI.setFullHydrationModel({
              athlete,
              weeklyActivities: weeklyActivities || [],
              weeklyTotals: weeklyTotals || null
            });
            console.log('✅ ATHLETE WELCOME: Full hydration model cached');
          } else {
            console.warn('⚠️ ATHLETE WELCOME: Hydration returned success: false');
            setWarnings(prev => [...prev, response.data.error || 'Could not fully load your account']);
          }
        } catch (hydrateError: any) {
          console.warn('⚠️ ATHLETE WELCOME: Hydration failed:', hydrateError?.response?.status);
          // GLOBAL RULE: Never auto-redirect on hydration error
          // Show warning but allow user to continue
          if (hydrateError?.response?.status === 401) {
            // 401 means unauthorized - redirect to signup
            console.log('🚫 ATHLETE WELCOME: Unauthorized (401) → redirecting to signup');
            router.replace('/signup');
            return;
          } else {
            // All other errors (404, 500, etc.) - show warning but continue
            setWarnings(prev => [...prev, hydrateError?.response?.data?.error || 'Could not fully load your account']);
          }
        }

        // Setup complete - show button
        console.log('✅ ATHLETE WELCOME: ===== SETUP COMPLETE =====');
        setIsReady(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('❌ ATHLETE WELCOME: Unexpected error:', err);
        // GLOBAL RULE: Never auto-redirect on error
        // Only redirect on 401 (unauthorized)
        if (err?.response?.status === 401) {
          console.log('🚫 ATHLETE WELCOME: Unauthorized (401) → redirecting to signup');
          router.replace('/signup');
          return;
        }
        setError(err?.message || 'An unexpected error occurred');
        setIsReady(true);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  const handleLetsTrain = () => {
    const athlete = LocalStorageAPI.getAthlete();
    
    // Check if profile is complete (gofastHandle is the key indicator)
    if (!athlete || !athlete.gofastHandle || athlete.gofastHandle.trim() === '') {
      console.log('⚠️ ATHLETE WELCOME: Missing profile (no gofastHandle) → routing to profile setup');
      router.push('/profile');
      return;
    }

    // Profile complete - route to home
    console.log('✅ ATHLETE WELCOME: Profile complete → routing to home');
    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 animate-pulse">
          Let's Go <span className="text-orange-400">Crush</span> Goals!
        </h1>
        <p className="text-2xl md:text-3xl text-sky-100 font-medium mb-8">
          Start your running journey
        </p>
        
        {isLoading && (
          <div className="mt-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-xl text-sky-100">Setting up your account...</p>
          </div>
        )}

        {isReady && !isLoading && (
          <div className="mt-8">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4 max-w-md mx-auto">
                <p className="text-red-100 text-sm">{error}</p>
              </div>
            )}
            
            {warnings.length > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4 max-w-md mx-auto">
                <p className="text-yellow-100 text-sm font-semibold mb-2">⚠️ Warnings:</p>
                <ul className="text-yellow-100 text-sm list-disc list-inside">
                  {warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
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
