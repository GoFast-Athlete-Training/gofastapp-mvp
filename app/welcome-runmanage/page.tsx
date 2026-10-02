'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { runManageSignInPath, RUN_MANAGE_DASHBOARD_PATH } from '@/lib/runmanage/door';
import { signOutRunManageDoor } from '@/lib/auth/product-door-sign-out';

type WelcomeState =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | {
      kind: 'ready';
      hasAccess: boolean;
      displayName: string | null;
      email: string | null;
      athleteId: string;
      firstName: string;
      lastName: string;
    };

export default function WelcomeRunManagePage() {
  const router = useRouter();
  const [view, setView] = useState<WelcomeState>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    LocalStorageAPI.setRunManageMode(true);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setView({ kind: 'signed_out' });
        return;
      }

      let athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        try {
          const meRes = await api.get('/athlete/me');
          if (meRes.data?.success && meRes.data?.athleteId) {
            athleteId = meRes.data.athleteId as string;
            LocalStorageAPI.setAthleteId(athleteId);
          } else {
            router.replace('/welcome');
            return;
          }
        } catch {
          router.replace('/welcome');
          return;
        }
      }

      try {
        const accessRes = await api.get('/me/run-manage-access');
        const hasAccess = Boolean(accessRes.data?.hasAccess);
        const prof = await api.get(`/athlete/${athleteId}`);
        const athlete = prof.data?.athlete;
        const firstName =
          athlete?.firstName?.trim() ||
          user.displayName?.trim().split(/\s+/)[0] ||
          '';
        const lastName =
          athlete?.lastName?.trim() ||
          user.displayName?.trim().split(/\s+/).slice(1).join(' ') ||
          '';
        const displayName =
          [firstName, lastName].filter(Boolean).join(' ').trim() ||
          athlete?.gofastHandle ||
          user.displayName ||
          null;

        setView({
          kind: 'ready',
          hasAccess,
          displayName,
          email: user.email ?? null,
          athleteId,
          firstName,
          lastName,
        });
      } catch {
        setView({
          kind: 'ready',
          hasAccess: false,
          displayName: user.displayName ?? user.email,
          email: user.email ?? null,
          athleteId: athleteId!,
          firstName: user.displayName?.split(/\s+/)[0] ?? '',
          lastName: user.displayName?.split(/\s+/).slice(1).join(' ') ?? '',
        });
      }
    });

    return () => unsub();
  }, [router]);

  async function handleSwitchAccount() {
    const path = await signOutRunManageDoor();
    router.replace(path);
  }

  async function handleStartManaging(state: Extract<WelcomeState, { kind: 'ready' }>) {
    if (!state.hasAccess) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/athlete/${state.athleteId}/profile`, {
        firstName: state.firstName.trim() || null,
        lastName: state.lastName.trim() || null,
      });
      router.replace(RUN_MANAGE_DASHBOARD_PATH);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save your name');
    } finally {
      setSaving(false);
    }
  }

  if (view.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (view.kind === 'signed_out') {
    const returnUrl = encodeURIComponent('/welcome-runmanage');
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <Image
            src="/logo.jpg"
            alt="GoFast Logo"
            width={112}
            height={112}
            className="mx-auto h-28 w-28 rounded-full object-contain shadow-xl"
            priority
          />
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-white/80">Run Manage</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Sign in to Run Manage</h1>
          <p className="mt-3 text-base text-white/90">
            Sign in with your GoFast athlete account that has Run Manage access.
          </p>
          <Link
            href={runManageSignInPath()}
            className="mt-8 inline-flex w-full max-w-sm justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            Run Manage sign in
          </Link>
        </div>
      </div>
    );
  }

  const headline = view.displayName
    ? `Welcome, ${view.displayName.split(/\s+/)[0]}`
    : 'Confirm your details';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full text-center">
        <Image
          src="/logo.jpg"
          alt="GoFast Logo"
          width={112}
          height={112}
          className="mx-auto h-28 w-28 rounded-full object-contain shadow-xl"
          priority
        />
        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-white/80">Run Manage</p>
        <h1 className="mt-2 text-3xl font-bold text-white">{headline}</h1>
        <p className="mt-3 text-base text-white/90">
          {view.hasAccess
            ? 'Confirm your name, then start managing city runs.'
            : "You're signed in, but Run Manage access isn't active on this account yet."}
        </p>
        {view.email ? <p className="mt-1 text-sm text-white/70">{view.email}</p> : null}

        {view.hasAccess ? (
          <div className="mt-6 rounded-xl border border-white/30 bg-white/10 p-4 text-left backdrop-blur-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-white/90">First name</span>
                <input
                  type="text"
                  value={view.firstName}
                  onChange={(e) =>
                    setView((v) =>
                      v.kind === 'ready' ? { ...v, firstName: e.target.value } : v
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-gray-900"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-white/90">Last name</span>
                <input
                  type="text"
                  value={view.lastName}
                  onChange={(e) =>
                    setView((v) =>
                      v.kind === 'ready' ? { ...v, lastName: e.target.value } : v
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-gray-900"
                />
              </label>
            </div>
            {saveError ? <p className="mt-3 text-sm text-red-100">{saveError}</p> : null}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200/40 bg-amber-500/20 p-4 text-sm text-amber-50">
            Ask a founder to assign you in Admin Manage → Run Manage, then sign in again with this
            email.
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {view.hasAccess ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleStartManaging(view)}
              className="inline-flex w-full justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Start managing'}
            </button>
          ) : (
            <Link
              href="/runmanage/no-access"
              className="inline-flex w-full justify-center rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
            >
              Learn more
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleSwitchAccount()}
            className="text-sm font-medium text-white/90 underline hover:text-white"
          >
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
