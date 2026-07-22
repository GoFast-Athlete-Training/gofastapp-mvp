'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  goFastWithConfirmPath,
  goFastWithFrontDoorPath,
  headlineForTarget,
  type GoFastWithTarget,
} from '@/lib/gofast-with-me/gofast-with-bridge';
import {
  GoFastWithAppAllusion,
  GoFastWithBridgeShell,
  GoFastWithTargetCard,
} from '@/components/gofast-with-me/GoFastWithBridgeShell';

async function bootstrapAthleteAfterAuth(): Promise<{
  athleteId: string;
  gofastHandle: string | null;
}> {
  let athleteRes;
  try {
    const hydrateRes = await api.post('/athlete/hydrate', {});
    if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
      athleteRes = hydrateRes.data;
    } else {
      throw new Error('Hydrate invalid');
    }
  } catch (hydrateErr: unknown) {
    const status = (hydrateErr as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status !== 401) {
      const createRes = await api.post('/athlete/create', {});
      if (!createRes.data?.success) throw hydrateErr;
      athleteRes = createRes.data;
    } else {
      throw hydrateErr;
    }
  }

  const athleteId =
    athleteRes.athleteId ||
    athleteRes.athlete?.athleteId ||
    athleteRes.athlete?.id ||
    athleteRes.data?.athleteId;
  const athleteData = athleteRes.athlete || athleteRes.data;
  if (!athleteId) throw new Error('Failed to get athlete ID');

  localStorage.removeItem('athlete');
  localStorage.removeItem('athleteProfile');
  localStorage.removeItem('fullHydrationModel');
  LocalStorageAPI.setAthleteId(athleteId);

  return {
    athleteId,
    gofastHandle: athleteData?.gofastHandle ?? null,
  };
}

export default function GoFastWithSignupExplainerPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params?.handle as string)?.trim() || '';

  const [target, setTarget] = useState<GoFastWithTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setFetching(false);
      return;
    }

    LocalStorageAPI.setGwmFollowIntentHandle(handle);

    (async () => {
      try {
        const res = await api.get(`/follow/${encodeURIComponent(handle)}`);
        if (!res.data?.success || !res.data.target) {
          throw new Error(res.data?.error || 'Not found');
        }
        setTarget({
          hostAthleteId: res.data.target.hostAthleteId,
          slug: res.data.target.slug,
          displayName: res.data.target.displayName,
          firstName: res.data.target.firstName,
          gofastHandle: res.data.target.gofastHandle,
          photoURL: null,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setFetching(false);
      }
    })();
  }, [handle]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && LocalStorageAPI.getAthleteId()) {
        router.replace(goFastWithConfirmPath(handle));
      }
    });
    return () => unsub();
  }, [handle, router]);

  const afterAuth = async (uid: string, email: string | null) => {
    const { athleteId, gofastHandle } = await bootstrapAthleteAfterAuth();
    localStorage.setItem('firebaseId', uid);
    localStorage.setItem('email', email || '');
    LocalStorageAPI.setGwmFollowIntentHandle(handle);

    if (gofastHandle) {
      router.push(goFastWithConfirmPath(handle));
    } else {
      router.push('/athlete-create-profile');
    }
  };

  const handleGoogleSignUp = async () => {
    if (!target) return;
    try {
      setLoading(true);
      setError(null);
      LocalStorageAPI.setGwmFollowIntentHandle(handle);
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const token = await result.user.getIdToken(true);
      localStorage.setItem('firebaseToken', token);
      await afterAuth(result.user.uid, result.user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      LocalStorageAPI.setGwmFollowIntentHandle(handle);
      const result = await createUserWithEmailAndPassword(
        auth,
        emailData.email,
        emailData.password
      );
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      if (displayName) {
        await updateProfile(result.user, { displayName });
        await reload(result.user);
      }
      const token = await result.user.getIdToken(true);
      localStorage.setItem('firebaseToken', token);
      await afterAuth(result.user.uid, result.user.email);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Sign in instead.');
      } else {
        setError(err instanceof Error ? err.message : 'Sign up failed');
      }
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error && !target) {
    return (
      <GoFastWithBridgeShell backHref={goFastWithFrontDoorPath(handle)}>
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <p className="text-gray-700">{error}</p>
        </div>
      </GoFastWithBridgeShell>
    );
  }

  if (!target) return null;

  const headline = headlineForTarget(target);
  const confirmRedirect = encodeURIComponent(goFastWithConfirmPath(handle));
  const signupHref = `/signup?redirect=${confirmRedirect}`;
  const signinHref = `${signupHref}&mode=signin`;

  return (
    <GoFastWithBridgeShell backHref={goFastWithFrontDoorPath(handle)} backLabel="Back">
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
        <GoFastWithTargetCard target={target} headline={headline} />

        <div className="mb-6 text-left space-y-3 text-gray-700">
          <p className="text-base leading-relaxed">
            To GoFast with {target.firstName?.trim() || target.displayName}, create a free GoFast
            account — then confirm on the next step.
          </p>
          <p className="text-sm font-medium text-gray-900">This helps us:</p>
          <ul className="text-sm space-y-1 ml-4 list-disc">
            <li>keep runs and training organized</li>
            <li>connect you in the GoFast app</li>
            <li>make sure members are real people</li>
          </ul>
        </div>

        <GoFastWithAppAllusion />

        {error ? (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        ) : null}

        {!showEmailForm ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void handleGoogleSignUp()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing up…' : 'Sign up with Google'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Sign up with email
            </button>
            <Link
              href={signinHref}
              className="block w-full text-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              I already have an account
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleEmailSignUp(e)} className="mt-6 space-y-3">
            <input
              type="text"
              placeholder="First name"
              value={emailData.firstName}
              onChange={(e) => setEmailData({ ...emailData, firstName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl"
              required
              disabled={loading}
            />
            <input
              type="text"
              placeholder="Last name"
              value={emailData.lastName}
              onChange={(e) => setEmailData({ ...emailData, lastName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl"
              required
              disabled={loading}
            />
            <input
              type="email"
              placeholder="Email"
              value={emailData.email}
              onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl"
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password"
              value={emailData.password}
              onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl"
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={emailData.confirmPassword}
              onChange={(e) => setEmailData({ ...emailData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </GoFastWithBridgeShell>
  );
}
