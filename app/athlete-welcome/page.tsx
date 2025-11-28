'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function AthleteWelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hydrateAthlete = async () => {
      try {
        console.log('🚀 ATHLETE WELCOME: ===== STARTING HYDRATION =====');
        setIsLoading(true);
        setError(null);

        // Get Firebase user to ensure we have auth
        const user = auth.currentUser;
        
        if (!user) {
          console.log('❌ ATHLETE WELCOME: No Firebase user found → redirecting to signup');
          router.replace('/signup');
          return;
        }

        console.log('✅ ATHLETE WELCOME: Firebase user found');
        console.log('✅ ATHLETE WELCOME: Firebase UID:', user.uid);
        console.log('✅ ATHLETE WELCOME: Firebase Email:', user.email);
        console.log('🚀 ATHLETE WELCOME: Calling hydration endpoint...');
        
        // Call hydration endpoint (token automatically added by api interceptor)
        const response = await api.post('/athlete/hydrate');
        
        console.log('📡 ATHLETE WELCOME: Response received:', response.status);
        
        const { success, athlete } = response.data;

        if (!success || !athlete) {
          console.error('❌ ATHLETE WELCOME: Hydration failed:', response.data.error || 'Invalid response');
          setError(response.data.error || 'Failed to load athlete data');
          setIsLoading(false);
          return;
        }

        // Extract weeklyActivities and weeklyTotals from athlete object (backend puts them there)
        const weeklyActivities = athlete.weeklyActivities || [];
        const weeklyTotals = athlete.weeklyTotals || null;

        console.log('✅ ATHLETE WELCOME: Athlete hydrated successfully');
        console.log('✅ ATHLETE WELCOME: Athlete ID:', athlete.athleteId || athlete.id);
        console.log('✅ ATHLETE WELCOME: Email:', athlete.email);
        console.log('✅ ATHLETE WELCOME: Name:', athlete.firstName, athlete.lastName);
        console.log('✅ ATHLETE WELCOME: RunCrews count:', athlete.runCrews?.length || 0);
        console.log('✅ ATHLETE WELCOME: Weekly activities count:', weeklyActivities.length);
        
        if (athlete.runCrews && athlete.runCrews.length > 0) {
          console.log('✅ ATHLETE WELCOME: RunCrews:', athlete.runCrews.map((c: any) => c.name).join(', '));
        }

        // Store the complete Prisma model (athlete + all relations + activities)
        console.log('💾 ATHLETE WELCOME: Caching full hydration model to localStorage...');
        LocalStorageAPI.setFullHydrationModel({
          athlete,
          weeklyActivities: weeklyActivities,
          weeklyTotals: weeklyTotals
        });
        
        // Also store raw response as requested
        localStorage.setItem('gofastHydration', JSON.stringify(response.data));
        
        console.log('✅ ATHLETE WELCOME: Full hydration model cached');
        
        // Hydration complete - show button for user to click
        console.log('🎯 ATHLETE WELCOME: Hydration complete, ready for user action');
        console.log('✅ ATHLETE WELCOME: ===== HYDRATION SUCCESS =====');
        setIsHydrated(true);
        setIsLoading(false);
        
      } catch (error: any) {
        console.error('❌ ATHLETE WELCOME: ===== HYDRATION ERROR =====');
        console.error('❌ ATHLETE WELCOME: Error message:', error.message);
        console.error('❌ ATHLETE WELCOME: Error status:', error.response?.status);
        console.error('❌ ATHLETE WELCOME: Error data:', error.response?.data);
        
        setError(error.response?.data?.message || error.message || 'Failed to load athlete data');
        setIsLoading(false);
        
        // If 401, user not authenticated or token expired
        if (error.response?.status === 401) {
          console.log('🚫 ATHLETE WELCOME: Unauthorized (401) → redirecting to signup');
          router.replace('/signup');
          return;
        }
        
        // If user not found, redirect to signup
        if (error.response?.status === 404) {
          console.log('👤 ATHLETE WELCOME: Athlete not found (404) → redirecting to signup');
          router.replace('/signup');
          return;
        }
        
        console.error('❌ ATHLETE WELCOME: ===== END ERROR =====');
      }
    };

    hydrateAthlete();
  }, [router]);

  const handleLetsTrain = () => {
    console.log('🎯 ATHLETE WELCOME: User clicked "Let\'s Train!" → navigating to athlete-home');
    router.push('/athlete-home');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
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
          </div>
        )}
      </div>
    </div>
  );
}
