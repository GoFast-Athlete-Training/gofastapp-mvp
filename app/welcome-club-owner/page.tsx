'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'activating' }
  | { kind: 'unmatched'; athleteEmail: string | null }
  | { kind: 'alreadyActive'; clubs: Array<{ runClubSlug: string | null; runClubName: string }> }
  | { kind: 'chooser'; claims: Array<{ id: string; runClubName: string; runClubSlug: string | null }> }
  | { kind: 'error'; message: string };

/** Legacy fallback when a manager record exists for email but no activation token was used. */
export default function WelcomeClubOwnerFallbackPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [athleteEmail, setAthleteEmail] = useState<string | null>(null);

  const activateClaim = useCallback(
    async (claimId: string, runClubSlug: string | null) => {
      setView({ kind: 'activating' });
      try {
        const res = await api.post('/me/club-leader-claim/attach', { claimId });
        if (!res.data?.success) {
          throw new Error(res.data?.error ?? 'Activation failed');
        }
        LocalStorageAPI.clearClubManagerMode();
        const slug = res.data.runClubSlug ?? runClubSlug;
        router.replace(slug ? clubManagerClubPath(slug) : clubManagerHubPath());
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data
          ?.code;
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not activate manager access';
        if (code === 'NO_SEEDED_LEADER_FOR_EMAIL') {
          setView({ kind: 'unmatched', athleteEmail });
          return;
        }
        setView({ kind: 'error', message });
      }
    },
    [router, athleteEmail]
  );

  const loadResolve = useCallback(async () => {
    setView({ kind: 'loading' });
    const res = await api.get('/me/club-leader-claims/resolve');
    const data = res.data;
    if (!data?.success) {
      setView({ kind: 'error', message: 'Could not check manager setup' });
      return;
    }
    if (data.state === 'unmatched') {
      setAthleteEmail(data.athleteEmail ?? null);
      setView({ kind: 'unmatched', athleteEmail: data.athleteEmail ?? null });
      return;
    }
    if (data.state === 'alreadyActive') {
      const clubs = data.clubs ?? [];
      if (clubs.length === 1 && clubs[0]?.runClubSlug) {
        router.replace(clubManagerClubPath(clubs[0].runClubSlug));
        return;
      }
      setView({ kind: 'alreadyActive', clubs });
      return;
    }
    if (data.state === 'matchedOne' && data.claim?.id) {
      await activateClaim(data.claim.id, data.claim.runClubSlug ?? null);
      return;
    }
    if (data.state === 'matchedMany') {
      setView({
        kind: 'chooser',
        claims: (data.claims ?? []).map(
          (c: { id: string; runClubName: string; runClubSlug: string | null }) => ({
            id: c.id,
            runClubName: c.runClubName,
            runClubSlug: c.runClubSlug,
          })
        ),
      });
    }
  }, [activateClaim, router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        LocalStorageAPI.setClubManagerMode(true);
        router.replace('/signup?mode=club-manager');
        return;
      }
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace('/signup?mode=club-manager');
        return;
      }
      setAthleteEmail(user.email);
      await loadResolve();
    });
    return () => unsub();
  }, [router, loadResolve]);

  if (view.kind === 'loading' || view.kind === 'activating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {view.kind === 'activating' ? 'Activating Club Manager access…' : 'Checking manager setup…'}
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === 'unmatched') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 shadow-sm p-8">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Club Manager setup</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900">
            We could not find manager access for this email
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            You signed in as <span className="font-medium">{athleteEmail ?? 'this account'}</span>. Use
            the activation link GoFast sent you, or ask staff to resend the invite.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={async () => {
                LocalStorageAPI.setClubManagerMode(true);
                await signOut(auth);
                router.replace(clubManagerHubPath());
              }}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={() => {
                LocalStorageAPI.clearClubManagerMode();
                router.replace('/athlete-home');
              }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Continue as athlete
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'alreadyActive') {
    const club = view.clubs[0];
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900">You&apos;re already set up</h1>
          <p className="mt-2 text-sm text-gray-600">Your Club Manager access is active.</p>
          <Link
            href={club?.runClubSlug ? clubManagerClubPath(club.runClubSlug) : clubManagerHubPath()}
            className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white"
          >
            Open Club Manager
          </Link>
        </div>
      </div>
    );
  }

  if (view.kind === 'chooser') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900">Choose a club to manage first</h1>
          <p className="mt-2 text-sm text-gray-600">
            We found multiple clubs connected to this email. Which club do you want to manage first?
          </p>
          <ul className="mt-6 space-y-3">
            {view.claims.map((claim) => (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => activateClaim(claim.id, claim.runClubSlug)}
                  className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-sky-400 hover:bg-sky-50"
                >
                  <span className="font-semibold text-gray-900">{claim.runClubName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-gray-600">{view.kind === 'error' ? view.message : 'Something went wrong'}</p>
    </div>
  );
}
