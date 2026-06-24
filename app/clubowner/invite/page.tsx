'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

type InviteClaim = {
  id: string;
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
  email: string;
  membershipRole: string;
  status: string;
  inviteExpiresAt: string | null;
};

type ViewState =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; claim: InviteClaim }
  | { kind: 'attaching' }
  | { kind: 'email_mismatch'; claim: InviteClaim; athleteEmail: string | null }
  | { kind: 'error'; message: string };

function ClubOwnerInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const claimRef = useRef<InviteClaim | null>(null);
  const attachStartedRef = useRef(false);

  const resolveInvite = useCallback(async (token: string) => {
    setView({ kind: 'loading' });
    try {
      const res = await api.get(`/clubowner/invite/resolve?token=${encodeURIComponent(token)}`);
      if (!res.data?.success || !res.data?.claim) {
        throw new Error(res.data?.error ?? 'Invalid invite');
      }
      setView({ kind: 'ready', claim: res.data.claim as InviteClaim });
      claimRef.current = res.data.claim as InviteClaim;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Invalid invite link');
      setView({ kind: 'invalid', message });
    }
  }, []);

  const attachInvite = useCallback(
    async (token: string) => {
      setView((v) => (v.kind === 'ready' ? { kind: 'attaching' } : v));
      try {
        const res = await api.post('/me/club-leader-claim/attach', { inviteToken: token });
        if (!res.data?.success) {
          throw new Error(res.data?.error ?? 'Could not claim manager access');
        }
        LocalStorageAPI.clearClubOwnerMode();
        LocalStorageAPI.clearClubOwnerInviteToken();
        const slug = res.data.runClubSlug as string | null;
        router.replace(slug ? `/leader/runclub/${slug}` : '/leader');
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string; error?: string } } })?.response
          ?.data?.code;
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not claim manager access';
        if (code === 'NO_SEEDED_LEADER_FOR_EMAIL' || code === 'EMAIL_MISMATCH') {
          setView((v) =>
            v.kind === 'ready' || v.kind === 'attaching'
              ? {
                  kind: 'email_mismatch',
                  claim: (v as { claim: InviteClaim }).claim,
                  athleteEmail: auth.currentUser?.email ?? null,
                }
              : v
          );
          return;
        }
        setView({ kind: 'error', message });
      }
    },
    [router]
  );

  useEffect(() => {
    const fromUrl = searchParams?.get('token')?.trim();
    const fromStorage = LocalStorageAPI.getClubOwnerInviteToken();
    const token = fromUrl || fromStorage;
    if (!token) {
      setView({ kind: 'invalid', message: 'Missing invite token' });
      return;
    }
    LocalStorageAPI.setClubOwnerInviteToken(token);
    LocalStorageAPI.setClubOwnerMode(true);
    setInviteToken(token);
    void resolveInvite(token);
  }, [searchParams, resolveInvite]);

  useEffect(() => {
    if (!inviteToken || attachStartedRef.current) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      const claim = claimRef.current;
      if (!claim || !user || attachStartedRef.current) return;

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) return;

      try {
        const prof = await api.get(`/athlete/${athleteId}`);
        const athlete = prof.data?.athlete;
        if (!athlete?.gofastHandle) return;

        const expected = claim.email.toLowerCase();
        const actual = (user.email ?? '').toLowerCase();
        if (actual && expected !== actual) {
          setView({ kind: 'email_mismatch', claim, athleteEmail: user.email });
          return;
        }

        attachStartedRef.current = true;
        await attachInvite(inviteToken);
      } catch {
        // wait for profile completion
      }
    });

    return () => unsub();
  }, [inviteToken, attachInvite]);

  if (view.kind === 'loading' || view.kind === 'attaching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {view.kind === 'attaching' ? 'Activating manager access…' : 'Loading invite…'}
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === 'invalid' || view.kind === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Invite unavailable</h1>
          <p className="mt-3 text-sm text-gray-600">{view.message}</p>
          <Link
            href="/clubowner"
            className="mt-6 inline-block rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Go to club manager entry
          </Link>
        </div>
      </div>
    );
  }

  if (view.kind === 'email_mismatch') {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 p-8">
          <h1 className="text-xl font-bold text-gray-900">Wrong email for this invite</h1>
          <p className="mt-3 text-sm text-gray-600">
            This invite is for <span className="font-medium">{view.claim.email}</span>. You signed in
            as <span className="font-medium">{view.athleteEmail ?? 'another account'}</span>.
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              router.replace(`/clubowner/invite?token=${encodeURIComponent(inviteToken ?? '')}`);
            }}
            className="mt-6 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Sign in with {view.claim.email}
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = view.claim.membershipRole === 'owner' ? 'Owner' : 'Club manager';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Manager invite</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{view.claim.runClubName}</h1>
        <p className="mt-3 text-sm text-gray-600">
          You&apos;ve been invited to manage this run club as <span className="font-medium">{roleLabel}</span>.
          Sign in or create an account with <span className="font-medium">{view.claim.email}</span> to
          activate access.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/signup?mode=club-owner"
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white text-center hover:bg-sky-700"
          >
            Get started
          </Link>
          <Link
            href="/signup?mode=club-owner"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-center hover:bg-gray-50"
          >
            I already have an account — sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClubOwnerInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
        </div>
      }
    >
      <ClubOwnerInviteContent />
    </Suspense>
  );
}
