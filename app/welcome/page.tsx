'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      try {
        // Universal hydration - ONE API call
        const response = await api.post('/athlete/hydrate');
        
        if (response.data.success) {
          const { athlete, crews, weeklyActivities, weeklyTotals } = response.data;

          // Store in localStorage
          LocalStorageAPI.setAthlete(athlete);
          LocalStorageAPI.setCrews(crews);
          LocalStorageAPI.setHydrationTimestamp(Date.now());

          // Redirect to home
          router.push('/home');
        } else {
          setError('Failed to hydrate athlete data');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Hydration error:', err);
        setError(err.response?.data?.error || 'Failed to load athlete data');
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}

