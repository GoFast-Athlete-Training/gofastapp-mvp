'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  clubManagerClubPath,
  clubManagerHubPath,
  clubManagerWelcomePath,
} from '@/lib/club-manager-paths';
import { resolveClubManagerHomePath } from '@/lib/club-manager-home-route';
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
      gofastHandle: string | null;
    };

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
          gofastHandle: athlete?.gofastHandle?.trim() || null,
        });
      } catch {
        setView({
          kind: 'ready',
          clubs: [],
          displayName: user.email,
          email: user.email,
          gofastHandle: null,
        });
      }
    });

    return () => unsub();
  }, [router]);

  if (view.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (view.kind === 'signed_out') {
    // Return door for managers who already have an athlete account (not invite activation).
    const returnUrl = encodeURIComponent(clubManagerWelcomePath());
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <Image
            src="/logo.png"
            alt="GoFast Logo"
            width={112}
            height={112}
            className="mx-auto h-28 w-28 rounded-full object-cover shadow-xl"
            priority
          />
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-white/80">Club Manager</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Welcome back</h1>
          <p className="mt-3 text-base text-white/90">
            Sign in with your GoFast athlete account that also manages a run club.
          </p>
          <Link
            href={`/signup?mode=club-manager&auth=signin&redirect=${returnUrl}`}
            className="mt-8 inline-flex w-full max-w-sm justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            Club Manager sign in
          </Link>
          <p className="mt-4 text-xs text-white/70">
            First-time invite? Open the activation link from your email instead.
          </p>
        </div>
      </div>
    );
  }

  const primaryClub = view.clubs[0] ?? null;
  const dashboardPath =
    view.clubs.length > 0
      ? resolveClubManagerHomePath(view.clubs) ?? clubManagerHubPath()
      : clubManagerHubPath();
  const isManager = view.clubs.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <Image
          src="/logo.png"
          alt="GoFast Logo"
          width={112}
          height={112}
          className="mx-auto h-28 w-28 rounded-full object-cover shadow-xl"
          priority
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-white/80">Club Manager</p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {view.displayName ? `Welcome back, ${view.displayName}` : 'Welcome back'}
        </h1>
        <p className="mt-3 text-base text-white/90">
          {isManager
            ? "You're a GoFast athlete and a club manager."
            : "You're signed in as a GoFast athlete. We don't see active manager membership yet."}
        </p>
        {view.gofastHandle ? (
          <p className="mt-1 text-sm text-white/70">@{view.gofastHandle}</p>
        ) : view.email ? (
          <p className="mt-1 text-sm text-white/70">{view.email}</p>
        ) : null}

        {isManager ? (
          <div className="mt-6 space-y-3 text-left">
            {view.clubs.map((club) => (
              <div
                key={club.runClubId}
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 backdrop-blur-sm"
              >
                <p className="font-semibold text-white">{club.runClubName}</p>
                <p className="text-sm text-white/80">
                  {formatClubManagerRoleLabel(club.role)} · active
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200/40 bg-amber-500/20 p-4 text-sm text-amber-50">
            If you were just added in Company, refresh in a moment — or open the invite activation
            link from email.
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          <Link
            href={dashboardPath}
            className="inline-flex w-full justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            {primaryClub ? `Manage ${primaryClub.runClubName}` : 'Open Club Manager'}
          </Link>
          <Link
            href="/athlete-home"
            className="inline-flex w-full justify-center rounded-xl border border-white/40 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Continue as athlete
          </Link>
        </div>

        {primaryClub?.runClubSlug ? (
          <p className="mt-3 text-center text-xs text-white/60">
            {clubManagerClubPath(primaryClub.runClubSlug)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
