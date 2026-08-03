'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { resolveClubManagerEntryPath } from '@/lib/club-manager-entry-route';

/**
 * Home — managers land in Club Manager; everyone else goes to athlete-home.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.warn('// REDIRECT DISABLED: /signup');
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace('/welcome');
        return;
      }

      try {
        const res = await api.get(`/athlete/${athleteId}`);
        const athlete = res.data?.athlete;
        const clubs = athlete?.leaderContext?.clubs;
        if (clubs?.length) {
          router.replace(
            resolveClubManagerEntryPath({
              clubs,
              clubManagerState: athlete?.clubManagerState,
            })
          );
          return;
        }
        router.replace('/athlete-home');
      } catch {
        router.replace('/athlete-home');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
        <p className="text-white text-lg">Loading...</p>
      </div>
    </div>
  );
}
