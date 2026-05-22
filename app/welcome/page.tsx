'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

const SESSION_GATE_KEY = 'gofast_uid_resolved';

type WelcomeStep = 'loading-local' | 'resolving-profile' | 'dashboard' | 'finish-profile';
type SecondaryCta = {
  label: string;
  action: 'dashboard' | 'profile';
};

type StoredSessionGate = {
  uid: string;
  athleteId: string;
  profileComplete: boolean;
};

function getSessionGate(): StoredSessionGate | null {
  try {
    const raw = sessionStorage.getItem(SESSION_GATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSessionGate>;
    if (
      typeof parsed.uid === 'string' &&
      typeof parsed.athleteId === 'string' &&
      typeof parsed.profileComplete === 'boolean'
    ) {
      return parsed as StoredSessionGate;
    }
    return null;
  } catch {
    return null;
  }
}

function setSessionGate(gate: StoredSessionGate) {
  try {
    sessionStorage.setItem(SESSION_GATE_KEY, JSON.stringify(gate));
  } catch {}
}

function clearSessionGate() {
  try {
    sessionStorage.removeItem(SESSION_GATE_KEY);
  } catch {}
}

function firstNameFromDisplayName(name: string | null | undefined): string | null {
  const first = (name || '').trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

function runnerNameFromSession(
  athlete: { firstName?: string | null; gofastHandle?: string | null } | undefined,
  user: Pick<User, 'displayName' | 'email'>
): string {
  return (
    athlete?.firstName?.trim() ||
    firstNameFromDisplayName(user.displayName) ||
    athlete?.gofastHandle?.trim() ||
    user.email?.split('@')[0] ||
    'runner'
  );
}

function stepCopy(step: WelcomeStep): string {
  switch (step) {
    case 'loading-local':
      return 'Loading your saved GoFast session.';
    case 'resolving-profile':
      return 'Checking your runner profile.';
    case 'dashboard':
      return 'Your dashboard is ready.';
    case 'finish-profile':
      return 'Your profile needs a few details.';
  }
}

/**
 * Welcome — auth gate: resolve athleteId once per session, store it, let the user choose next step.
 * Mirrors GoFast mobile welcome (no auto-advance after resolve).
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [runnerName, setRunnerName] = useState('runner');
  const [step, setStep] = useState<WelcomeStep>('loading-local');
  const [hasProfileHandle, setHasProfileHandle] = useState<boolean | null>(null);
  const [secondaryCta, setSecondaryCta] = useState<SecondaryCta | null>(null);

  useEffect(() => {
    if (hasProfileHandle == null) {
      setSecondaryCta(null);
      return;
    }

    setSecondaryCta(
      hasProfileHandle
        ? { label: 'View profile', action: 'profile' }
        : { label: 'Go to dashboard anyway', action: 'dashboard' }
    );
  }, [hasProfileHandle]);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasProcessedRef.current) {
        return;
      }

      if (!firebaseUser) {
        if (!LocalStorageAPI.getAthleteId()) {
          hasProcessedRef.current = true;
          clearSessionGate();
          router.replace('/signup');
        }
        return;
      }

      hasProcessedRef.current = true;
      setResolving(true);
      setError(null);
      setHasProfileHandle(null);

      try {
        setRunnerName(
          firstNameFromDisplayName(firebaseUser.displayName) ||
            firebaseUser.email?.split('@')[0] ||
            'runner'
        );
        setStep('loading-local');

        const storedAthleteId = LocalStorageAPI.getAthleteId();
        const gate = getSessionGate();
        if (
          gate &&
          gate.uid === firebaseUser.uid &&
          gate.athleteId === storedAthleteId &&
          storedAthleteId
        ) {
          const nextStep = gate.profileComplete ? 'dashboard' : 'finish-profile';
          setHasProfileHandle(gate.profileComplete);
          setStep(nextStep);
          setResolving(false);
          return;
        }

        setStep('resolving-profile');
        const token = await firebaseUser.getIdToken();
        let athleteId = storedAthleteId;
        let athlete:
          | { firstName?: string | null; gofastHandle?: string | null }
          | undefined;

        try {
          const response = await api.get('/athlete/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.data?.success && response.data?.athleteId) {
            athleteId = response.data.athleteId;
            LocalStorageAPI.setAthleteId(athleteId);
            const profRes = await api.get(`/athlete/${athleteId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            athlete = profRes.data?.athlete;
          } else {
            throw new Error('Invalid response from /athlete/me');
          }
        } catch (err: any) {
          if (err?.response?.status !== 404) {
            throw err;
          }

          const createRes = await api.post('/athlete/create', {});
          if (!createRes.data?.success || !createRes.data?.athleteId) {
            throw new Error('Create route did not return valid athlete data');
          }

          localStorage.removeItem('athlete');
          localStorage.removeItem('athleteProfile');
          localStorage.removeItem('fullHydrationModel');
          localStorage.removeItem('weeklyActivities');
          localStorage.removeItem('weeklyTotals');
          localStorage.setItem('firebaseId', firebaseUser.uid);
          localStorage.setItem('email', createRes.data.data?.email || firebaseUser.email || '');

          athleteId = createRes.data.athleteId;
          LocalStorageAPI.setAthleteId(athleteId);
          athlete = createRes.data.data;
        }

        const hasHandle = !!athlete?.gofastHandle?.trim();
        setRunnerName(runnerNameFromSession(athlete, firebaseUser));
        setHasProfileHandle(hasHandle);
        setStep(hasHandle ? 'dashboard' : 'finish-profile');
        setSessionGate({
          uid: firebaseUser.uid,
          athleteId,
          profileComplete: hasHandle,
        });
        setResolving(false);
      } catch (err: any) {
        console.error('❌ Welcome: session resolve failed:', err?.response?.status || err?.message);

        if (err?.response?.status === 401) {
          setError('Authentication error. Please sign out and sign in again.');
        } else {
          setError(err?.response?.data?.error || err?.message || 'Could not load your GoFast profile.');
        }
        setResolving(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleBackToSignIn() {
    await signOut(auth);
    clearSessionGate();
    router.replace('/signup');
  }

  function goToDashboard() {
    router.replace('/athlete-home');
  }

  function goToProfile() {
    router.replace(hasProfileHandle ? '/profile' : '/athlete-create-profile');
  }

  const recommendProfile = hasProfileHandle === false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo.png"
          alt="GoFast Logo"
          width={112}
          height={112}
          className="mx-auto h-28 w-28 rounded-full object-cover shadow-xl"
          priority
        />

        <h1 className="mt-8 text-3xl font-bold text-white">Welcome, {runnerName}</h1>
        <p className="mt-2 text-base text-white/90">{stepCopy(step)}</p>
        {!error && !resolving ? (
          <p className="mt-2 text-sm text-white/80">Choose where to go next.</p>
        ) : null}

        {error ? (
          <div className="mt-8 w-full rounded-2xl border border-red-400/50 bg-red-500/20 p-4">
            <p className="text-center text-sm text-red-100">{error}</p>
            <button
              type="button"
              onClick={() => void handleBackToSignIn()}
              className="mt-4 w-full rounded-xl bg-white px-5 py-3 font-bold text-sky-600"
            >
              Back to sign in
            </button>
          </div>
        ) : resolving ? (
          <div className="mt-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        ) : (
          <div className="mt-8 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={recommendProfile ? goToProfile : goToDashboard}
              className={`w-full rounded-xl px-5 py-4 text-base font-bold ${
                recommendProfile ? 'bg-white text-sky-600' : 'bg-white/15 text-white'
              }`}
            >
              {recommendProfile ? 'Finish profile' : 'Go to dashboard'}
            </button>

            <button
              type="button"
              onClick={secondaryCta?.action === 'dashboard' ? goToDashboard : goToProfile}
              className="w-full rounded-xl border border-white/40 px-5 py-4 text-base font-semibold text-white"
            >
              {secondaryCta?.label ?? 'View profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
