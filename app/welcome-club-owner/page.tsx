'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { resolveClubManagerEntryPath } from '@/lib/club-manager-entry-route';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

/** Deprecated email-hunt path — DB membership wins over stale invite token. */
export default function WelcomeClubOwnerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(resolveClubManagerEntryPath({}));
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace(resolveClubManagerEntryPath({}));
        return;
      }

      try {
        const prof = await api.get(`/athlete/${athleteId}`);
        const clubs = (prof.data?.athlete?.leaderContext?.clubs ?? []) as LeaderContextClub[];
        router.replace(
          resolveClubManagerEntryPath({
            clubs,
            clubManagerState: prof.data?.athlete?.clubManagerState,
          })
        );
      } catch {
        router.replace(resolveClubManagerEntryPath({}));
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <p className="text-sm text-gray-600">Redirecting to Club Manager…</p>
    </div>
  );
}
