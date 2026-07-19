'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerActivatePath, clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import { formatClubManagerRoleLabel } from '@/lib/club-manager-membership-roles';

type ActivationContext = {
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
  | { kind: 'ready'; activation: ActivationContext }
  | { kind: 'activating' }
  | { kind: 'email_mismatch'; activation: ActivationContext; athleteEmail: string | null }
  | { kind: 'error'; message: string };

function ClubManagerActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const activationRef = useRef<ActivationContext | null>(null);
  const activateStartedRef = useRef(false);

  const resolveActivation = useCallback(async (token: string) => {
    setView({ kind: 'loading' });
    try {
      const res = await api.get(`/club-manager/invite/resolve?token=${encodeURIComponent(token)}`);
      const invite = (res.data?.invite ?? res.data?.claim) as ActivationContext | undefined;
      if (!res.data?.success || !invite) {
        throw new Error(res.data?.error ?? 'Invalid activation link');
      }
      const activation = invite;
      setView({ kind: 'ready', activation });
      activationRef.current = activation;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Invalid activation link');
      setView({ kind: 'invalid', message });
    }
  }, []);

  const activateManagerAccess = useCallback(
    async (token: string) => {
      setView((v) => (v.kind === 'ready' ? { kind: 'activating' } : v));
      try {
        const res = await api.post('/me/club-manager-resolve', { inviteToken: token });
        if (!res.data?.success) {
          throw new Error(res.data?.error ?? 'Could not activate manager access');
        }
        LocalStorageAPI.clearClubManagerMode();
        const slug = res.data.runClubSlug as string | null;
        router.replace(slug ? clubManagerClubPath(slug) : clubManagerHubPath());
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string; error?: string } } })?.response
          ?.data?.code;
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not activate manager access';
        if (code === 'NO_INVITE_FOR_EMAIL' || code === 'NO_SEEDED_LEADER_FOR_EMAIL' || code === 'EMAIL_MISMATCH') {
          setView((v) =>
            v.kind === 'ready' || v.kind === 'activating'
              ? {
                  kind: 'email_mismatch',
                  activation: (v as { activation: ActivationContext }).activation,
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
    const fromStorage = LocalStorageAPI.getClubManagerActivationToken();
    const token = fromUrl || fromStorage;
    if (!token) {
      setView({
        kind: 'invalid',
        message: 'Missing activation token. Open the manager invite link from your email.',
      });
      return;
    }
    LocalStorageAPI.setClubManagerActivationToken(token);
    LocalStorageAPI.setClubManagerMode(true);
    setActivationToken(token);
    void resolveActivation(token);
  }, [searchParams, resolveActivation]);

  useEffect(() => {
    if (!activationToken || activateStartedRef.current) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      const activation = activationRef.current;
      if (!activation || !user || activateStartedRef.current) return;

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) return;

      try {
        const prof = await api.get(`/athlete/${athleteId}`);
        const athlete = prof.data?.athlete;
        if (!athlete?.gofastHandle) return;

        const expected = activation.email.toLowerCase();
        const actual = (user.email ?? '').toLowerCase();
        if (actual && expected !== actual) {
          setView({ kind: 'email_mismatch', activation, athleteEmail: user.email });
          return;
        }

        activateStartedRef.current = true;
        await activateManagerAccess(activationToken);
      } catch {
        // wait for profile completion
      }
    });

    return () => unsub();
  }, [activationToken, activateManagerAccess]);

  if (view.kind === 'loading' || view.kind === 'activating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {view.kind === 'activating' ? 'Activating Club Manager access…' : 'Loading activation…'}
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === 'invalid' || view.kind === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Activation unavailable</h1>
          <p className="mt-3 text-sm text-gray-600">{view.message}</p>
          <Link
            href={clubManagerHubPath()}
            className="mt-6 inline-block rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Go to Club Manager
          </Link>
        </div>
      </div>
    );
  }

  if (view.kind === 'email_mismatch') {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 p-8">
          <h1 className="text-xl font-bold text-gray-900">Wrong email for this activation</h1>
          <p className="mt-3 text-sm text-gray-600">
            This activation is for <span className="font-medium">{view.activation.email}</span>. You
            signed in as <span className="font-medium">{view.athleteEmail ?? 'another account'}</span>.
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              router.replace(clubManagerActivatePath(activationToken ?? ''));
            }}
            className="mt-6 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Sign in with {view.activation.email}
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = formatClubManagerRoleLabel(view.activation.membershipRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Club Manager activation</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{view.activation.runClubName}</h1>
        <p className="mt-3 text-sm text-gray-600">
          You&apos;ve been invited to manage this run club as{' '}
          <span className="font-medium">{roleLabel}</span>. Sign in or create a GoFast account with{' '}
          <span className="font-medium">{view.activation.email}</span> to activate access.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/signup?mode=club-manager"
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white text-center hover:bg-sky-700"
          >
            Get started
          </Link>
          <Link
            href="/signup?mode=club-manager"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-center hover:bg-gray-50"
          >
            I already have an account — sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClubManagerActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
        </div>
      }
    >
      <ClubManagerActivateContent />
    </Suspense>
  );
}
