'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerActivatePath, clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import { resolveClubManagerEntryPath } from '@/lib/club-manager-entry-route';
import ClubManagerHubShell from '@/components/runclub/manager/ClubManagerHubShell';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

export default function ClubManagerHubPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [clubs, setClubs] = useState<LeaderContextClub[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerHubPath())}`);
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace('/welcome');
        return;
      }

      try {
        const profileRes = await api.get(`/athlete/${athleteId}`);
        const athlete = profileRes.data?.athlete;
        const athleteClubs = athlete?.leaderContext?.clubs ?? [];
        setClubs(athleteClubs);

        const entryPath = resolveClubManagerEntryPath({
          clubs: athleteClubs,
          clubManagerState: athlete?.clubManagerState,
        });
        if (entryPath !== clubManagerHubPath()) {
          router.replace(entryPath);
          return;
        }
      } catch {
        setClubs([]);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading Club Manager…</p>
        </div>
      </div>
    );
  }

  const activationToken = LocalStorageAPI.getClubManagerActivationToken();

  return (
    <ClubManagerHubShell clubs={clubs}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Club Manager</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Your clubs</h1>
        <p className="mt-2 text-gray-600">
          Manage club profile, runs, and announcements. You&apos;re still a full GoFast athlete — use
          Back to athlete anytime.
        </p>

        {clubs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="text-xl font-bold text-gray-900">No manager access yet</h2>
            <p className="mt-2 text-sm text-gray-600">
              Open the manager invite link GoFast sent you, or ask staff to resend one.
            </p>
            {activationToken ? (
              <Link
                href={clubManagerActivatePath(activationToken)}
                className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Continue invite activation
              </Link>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Manager invites always include an activation link — email match alone is not enough.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {clubs.map((club) => (
              <Link
                key={club.runClubId}
                href={clubManagerClubPath(club.runClubSlug ?? club.runClubId)}
                className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-orange-300 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-4">
                  {club.logoUrl ? (
                    <img
                      src={club.logoUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-100 text-2xl">
                      🏃
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-gray-900">{club.runClubName}</h2>
                    <p className="text-sm text-gray-500 capitalize">
                      {[club.city, club.state].filter(Boolean).join(', ') || 'Location TBD'} ·{' '}
                      {club.role}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-orange-600">Manage →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClubManagerHubShell>
  );
}
