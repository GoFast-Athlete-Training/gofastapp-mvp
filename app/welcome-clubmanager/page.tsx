'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerHubPath } from '@/lib/club-manager-paths';
import { resolveClubManagerEntryPath } from '@/lib/club-manager-entry-route';
import { allManagerClubsWelcomed, parseClubManagerState } from '@/lib/club-manager-state';
import { formatClubManagerRoleLabel } from '@/lib/club-manager-membership-roles';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

type WelcomeState =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | {
      kind: 'ready';
      clubs: LeaderContextClub[];
      displayName: string | null;
      email: string | null;
    };

export default function WelcomeClubManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<WelcomeState>({ kind: 'loading' });
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      try {
        const meRes = await api.get('/athlete/me');
        if (meRes.data?.success && meRes.data?.athleteId) {
          LocalStorageAPI.setAthleteId(meRes.data.athleteId as string);
        } else {
          router.replace('/welcome');
          return null;
        }
      } catch {
        router.replace('/welcome');
        return null;
      }
    }

    const resolvedAthleteId = LocalStorageAPI.getAthleteId();
    if (!resolvedAthleteId) {
      router.replace('/welcome');
      return null;
    }

    const prof = await api.get(`/athlete/${resolvedAthleteId}`);
    return prof.data?.athlete as {
      firstName?: string | null;
      lastName?: string | null;
      gofastHandle?: string | null;
      email?: string | null;
      leaderContext?: { clubs?: LeaderContextClub[] };
      clubManagerState?: unknown;
    } | undefined;
  }, [router]);

  useEffect(() => {
    LocalStorageAPI.setClubManagerMode(true);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setView({ kind: 'signed_out' });
        return;
      }

      try {
        const athlete = await loadProfile();
        if (!athlete) return;

        const clubs = (athlete.leaderContext?.clubs ?? []) as LeaderContextClub[];
        const state = parseClubManagerState(athlete.clubManagerState);

        if (clubs.length > 0 && allManagerClubsWelcomed(state, clubs)) {
          router.replace(
            resolveClubManagerEntryPath({
              clubs,
              clubManagerState: state,
            })
          );
          return;
        }

        setView({
          kind: 'ready',
          clubs,
          displayName:
            [athlete.firstName, athlete.lastName].filter(Boolean).join(' ').trim() ||
            athlete.gofastHandle ||
            null,
          email: user.email ?? athlete.email ?? null,
        });
      } catch {
        setView({
          kind: 'ready',
          clubs: [],
          displayName: user.email,
          email: user.email,
        });
      }
    });

    return () => unsub();
  }, [loadProfile, router]);

  const handleContinue = async () => {
    if (view.kind !== 'ready' || view.clubs.length === 0 || continuing) return;

    setContinuing(true);
    setError(null);
    try {
      const res = await api.post('/me/club-manager-welcome');
      if (!res.data?.success) {
        throw new Error(res.data?.error ?? 'Could not continue');
      }
      LocalStorageAPI.clearClubManagerActivationToken();
      router.replace(res.data.homePath ?? clubManagerHubPath());
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Could not continue');
      setError(message);
      setContinuing(false);
    }
  };

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
            Sign in with your GoFast account to manage your run club.
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Club Manager</p>
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
          <>
            <p className="mt-4 text-sm text-gray-600">
              You&apos;re set up to manage{' '}
              {view.clubs.length === 1 ? 'this club' : 'these clubs'} on GoFast.
            </p>
            <div className="mt-4 space-y-3">
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
          </>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          disabled={view.clubs.length === 0 || continuing}
          onClick={() => void handleContinue()}
          className="mt-8 inline-flex w-full justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {continuing
            ? 'Continuing…'
            : primaryClub
              ? `Continue to ${primaryClub.runClubName}`
              : 'Continue to Club Manager'}
        </button>
      </div>
    </div>
  );
}
