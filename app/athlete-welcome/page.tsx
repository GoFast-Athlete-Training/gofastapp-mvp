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
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log('❌ ATHLETE WELCOME: No Firebase user found → redirecting to signup');
        router.push('/');
        return;
      }

      try {
        console.log('🚀 ATHLETE WELCOME: ===== STARTING HYDRATION =====');
        setIsLoading(true);
        setError(null);

        console.log('✅ ATHLETE WELCOME: Firebase user found');
        console.log('✅ ATHLETE WELCOME: Firebase UID:', user.uid);
        console.log('✅ ATHLETE WELCOME: Firebase Email:', user.email);
        console.log('🚀 ATHLETE WELCOME: Calling hydration endpoint...');
        
        // Universal hydration - ONE API call
        const response = await api.post('/athlete/hydrate');
        
        console.log('📡 ATHLETE WELCOME: Response received:', response.status);
        
        if (response.data.success) {
          const { athlete, weeklyActivities, weeklyTotals } = response.data;

          console.log('✅ ATHLETE WELCOME: Athlete hydrated successfully');
          console.log('✅ ATHLETE WELCOME: Athlete ID:', athlete?.id);
          console.log('✅ ATHLETE WELCOME: Email:', athlete?.email);
          console.log('✅ ATHLETE WELCOME: Name:', athlete?.firstName, athlete?.lastName);
          console.log('✅ ATHLETE WELCOME: RunCrews count:', athlete?.runCrews?.length || 0);
          console.log('✅ ATHLETE WELCOME: Weekly activities count:', weeklyActivities?.length || 0);
          console.log('✅ ATHLETE WELCOME: Weekly totals:', weeklyTotals);
          
          if (athlete?.runCrews && athlete.runCrews.length > 0) {
            console.log('✅ ATHLETE WELCOME: RunCrews:', athlete.runCrews.map((c: any) => c.name).join(', '));
          }

          // Store the complete Prisma model (athlete + all relations + activities)
          console.log('💾 ATHLETE WELCOME: Caching full hydration model to localStorage...');
          LocalStorageAPI.setFullHydrationModel({
            athlete,
            weeklyActivities: weeklyActivities || [],
            weeklyTotals: weeklyTotals || null
          });
          console.log('✅ ATHLETE WELCOME: Full hydration model cached');
          
          // Hydration complete - show button for user to click
          console.log('🎯 ATHLETE WELCOME: Hydration complete, ready for user action');
          console.log('✅ ATHLETE WELCOME: ===== HYDRATION SUCCESS =====');
          setIsHydrated(true);
          setIsLoading(false);
        } else {
          // Hydration failed but continue anyway
          console.warn('⚠️ ATHLETE WELCOME: Hydration returned success: false');
          console.warn('⚠️ ATHLETE WELCOME: Error:', response.data.error);
          setError(response.data.error || 'Could not fully load your account');
          setIsHydrated(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        // On any error, still allow user to continue
        console.error('❌ ATHLETE WELCOME: ===== HYDRATION ERROR =====');
        console.error('❌ ATHLETE WELCOME: Error message:', err.message);
        console.error('❌ ATHLETE WELCOME: Error status:', err.response?.status);
        console.error('❌ ATHLETE WELCOME: Error data:', err.response?.data);
        
        // Only redirect on 401 (unauthorized)
        if (err.response?.status === 401) {
          console.log('🚫 ATHLETE WELCOME: Unauthorized (401) → redirecting to signup');
          router.push('/');
          return;
        }
        
        // For all other errors (404, 500, etc.), show soft warning and continue
        setError(err.response?.data?.error || err.message || 'Could not fully load your account');
        setIsHydrated(true);
        setIsLoading(false);
        console.log('✅ ATHLETE WELCOME: Allowing user to continue despite error');
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
            <p className="text-xl text-sky-100">Loading your account...</p>
          </div>
        )}

        {isHydrated && !isLoading && (
          <div className="mt-8">
            <button
              onClick={handleLetsTrain}
              className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-12 py-4 rounded-xl font-bold text-2xl hover:from-orange-700 hover:to-orange-600 transition shadow-2xl transform hover:scale-105"
            >
              Let's Train! →
            </button>
            
            {error && (
              <p className="text-white/80 text-sm mt-4">
                ⚠️ Could not fully load your account — continuing anyway.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

