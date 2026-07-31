'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  clubManagerClubPath,
  clubManagerHubPath,
} from '@/lib/club-manager-paths';
import { resolveClubManagerHomePath } from '@/lib/club-manager-home-route';
import { formatClubManagerRoleLabel } from '@/lib/club-manager-membership-roles';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

type WelcomeState =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'ready'; clubs: LeaderContextClub[]; displayName: string | null; email: string | null };

export default function WelcomeClubManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<WelcomeState>({ kind: 'loading' });

  useEffect(() => {
    LocalStorageAPI.setClubManagerMode(true);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setView({ kind: 'signed_out' });
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        try {
          const meRes = await api.get('/athlete/me');
          if (meRes.data?.success && meRes.data?.athleteId) {
            LocalStorageAPI.setAthleteId(meRes.data.athleteId as string);
          } else {
            router.replace('/welcome');
            return;
          }
        } catch {
          router.replace('/welcome');
          return;
        }
      }

      const resolvedAthleteId = LocalStorageAPI.getAthleteId();
      if (!resolvedAthleteId) {
        router.replace('/welcome');
        return;
      }

      try {
        const prof = await api.get(`/athlete/${resolvedAthleteId}`);
        const athlete = prof.data?.athlete;
        const clubs = (athlete?.leaderContext?.clubs ?? []) as LeaderContextClub[];
        setView({
          kind: 'ready',
          clubs,
          displayName:
            [athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ').trim() ||
            athlete?.gofastHandle ||
            null,
          email: user.email ?? athlete?.email ?? null,
        });
      } catch {
        setView({ kind: 'ready', clubs: [], displayName: user.email, email: user.email });
      }
    });

    return () => unsub();
  }, [router]);

  if (view.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (view.kind === 'signed_out') {
    const returnUrl = encodeURIComponent('/welcome-clubmanager');
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Club Manager</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Sign in to continue</h1>
          <p className="mt-3 text-sm text-gray-600">
            Sign in with your GoFast account to view your club manager access.
          </p>
          <Link
            href={`/signup?mode=club-manager&redirect=${returnUrl}`}
            className="mt-8 inline-flex w-full justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const primaryClub = view.clubs[0] ?? null;
  const dashboardPath =
    view.clubs.length > 0
      ? resolveClubManagerHomePath(view.clubs) ?? clubManagerHubPath()
      : clubManagerHubPath();

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Club Manager welcome</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {view.displayName ? `Welcome, ${view.displayName}` : 'Welcome'}
        </h1>
        {view.email ? <p className="mt-1 text-sm text-gray-500">{view.email}</p> : null}

        {view.clubs.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No active club manager memberships were found yet. If you were just added, try again in a
            moment or contact GoFast staff.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {view.clubs.map((club) => (
              <div
                key={club.runClubId}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <p className="font-semibold text-gray-900">{club.runClubName}</p>
                <p className="text-sm text-gray-600">
                  Role: {formatClubManagerRoleLabel(club.role)} · Status: active
                </p>
              </div>
            ))}
          </div>
        )}

        <Link
          href={dashboardPath}
          className="mt-8 inline-flex w-full justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
        >
          {primaryClub ? `Go to ${primaryClub.runClubName} dashboard` : 'Go to Club Manager'}
        </Link>

        {primaryClub?.runClubSlug ? (
          <p className="mt-3 text-center text-xs text-gray-500">
            {clubManagerClubPath(primaryClub.runClubSlug)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
