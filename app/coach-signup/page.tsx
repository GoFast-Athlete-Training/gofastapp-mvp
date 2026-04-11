'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  reload,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

async function loadOrCreateCoach() {
  try {
    const meRes = await api.get('/coach/me');
    if (meRes.data?.success && meRes.data?.coachId) {
      return {
        success: true,
        coachId: meRes.data.coachId as string,
        coach: meRes.data.coach,
      };
    }
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status !== 404) throw e;
  }
  const res = await api.post('/coach');
  return res.data as {
    success: boolean;
    coachId?: string;
    coach?: unknown;
    message?: string;
  };
}

export default function CoachSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      try {
        const firebaseToken = await user.getIdToken();
        localStorage.setItem('firebaseToken', firebaseToken);
        const out = await loadOrCreateCoach();
        if (out?.success && out.coachId) {
          localStorage.setItem('firebaseId', user.uid);
          localStorage.setItem('email', user.email || '');
          LocalStorageAPI.setCoachId(out.coachId);
          router.replace('/coach-hub');
          return;
        }
      } catch (err) {
        console.error('Coach signup auth check:', err);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const finishCoach = async (user: { uid: string; email: string | null }) => {
    const firebaseToken = await auth.currentUser?.getIdToken(true);
    if (firebaseToken) localStorage.setItem('firebaseToken', firebaseToken);
    const out = await loadOrCreateCoach();
    if (!out?.success || !out.coachId) {
      throw new Error('Could not create coach account');
    }
    localStorage.setItem('firebaseId', user.uid);
    localStorage.setItem('email', user.email || '');
    LocalStorageAPI.setCoachId(out.coachId);
    router.replace('/coach-hub');
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseToken = await result.user.getIdToken(true);
      localStorage.setItem('firebaseToken', firebaseToken);
      await finishCoach(result.user);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      if (e?.response?.status === 401) {
        setErrorMessage(
          'We could not verify your account with the server. Please try again in a few minutes.'
        );
      } else {
        setError(e?.message || 'Sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (emailData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');
      const result = await createUserWithEmailAndPassword(
        auth,
        emailData.email,
        emailData.password
      );
      const user = result.user;
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      if (displayName) {
        try {
          await updateProfile(user, { displayName });
          await reload(user);
        } catch {
          /* continue */
        }
      }
      const firebaseToken = await user.getIdToken(true);
      localStorage.setItem('firebaseToken', firebaseToken);
      await finishCoach(user);
    } catch (err: unknown) {
      const e = err as { code?: string; response?: { status?: number }; message?: string };
      if (e?.response?.status === 401) {
        setErrorMessage(
          'We could not verify your account with the server. Please try again in a few minutes.'
        );
      } else if (e.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
        setAuthMode('signin');
      } else {
        setError(e?.message || 'Sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');
      await signInWithEmailAndPassword(auth, emailData.email, emailData.password);
      const user = auth.currentUser;
      if (!user) throw new Error('No user after sign-in');
      const firebaseToken = await user.getIdToken(true);
      localStorage.setItem('firebaseToken', firebaseToken);
      await finishCoach(user);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      if (e?.response?.status === 401) {
        setErrorMessage(
          'We could not verify your account with the server. Please try again in a few minutes.'
        );
      } else {
        setError(e?.message || 'Sign in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-xl text-white/90">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700">
      <div className="max-w-lg mx-auto px-4 py-10 md:py-14">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={96}
              height={96}
              className="w-24 h-24 rounded-full shadow-xl mx-auto mb-4 object-cover"
              priority
            />
            <h1 className="text-3xl font-bold text-white mb-2">Coach sign up</h1>
            <p className="text-white/90">
              Manage training groups and assign workouts for your athletes
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm mb-4">
              {error}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm mb-4">
              {errorMessage}
            </div>
          )}

          {!showEmailForm ? (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 border-2 border-white/30 rounded-lg text-base font-medium text-white bg-white/20 hover:bg-white/30 disabled:opacity-50"
              >
                {loading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 border-t border-white/30" />
                <span className="text-white/60 text-sm">or</span>
                <div className="flex-1 border-t border-white/30" />
              </div>
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                disabled={loading}
                className="w-full py-3 px-6 rounded-lg font-medium text-amber-900 bg-white hover:bg-amber-50 disabled:opacity-50"
              >
                Continue with email
              </button>
              <p className="text-center text-white/80 text-sm mt-6">
                {authMode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="underline font-medium text-white"
                      onClick={() => setAuthMode('signin')}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Need an account?{' '}
                    <button
                      type="button"
                      className="underline font-medium text-white"
                      onClick={() => setAuthMode('signup')}
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </>
          ) : (
            <form
              onSubmit={authMode === 'signup' ? handleEmailSignup : handleEmailSignin}
              className="space-y-4"
            >
              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-white/90">First name</span>
                    <input
                      type="text"
                      required
                      value={emailData.firstName}
                      onChange={(e) =>
                        setEmailData((d) => ({ ...d, firstName: e.target.value }))
                      }
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/90 text-gray-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-white/90">Last name</span>
                    <input
                      type="text"
                      required
                      value={emailData.lastName}
                      onChange={(e) =>
                        setEmailData((d) => ({ ...d, lastName: e.target.value }))
                      }
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/90 text-gray-900"
                    />
                  </label>
                </div>
              )}
              <label className="block">
                <span className="text-xs font-medium text-white/90">Email</span>
                <input
                  type="email"
                  required
                  value={emailData.email}
                  onChange={(e) => setEmailData((d) => ({ ...d, email: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/90 text-gray-900"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-white/90">Password</span>
                <input
                  type="password"
                  required
                  value={emailData.password}
                  onChange={(e) => setEmailData((d) => ({ ...d, password: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/90 text-gray-900"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
              {authMode === 'signup' && (
                <label className="block">
                  <span className="text-xs font-medium text-white/90">Confirm password</span>
                  <input
                    type="password"
                    required
                    value={emailData.confirmPassword}
                    onChange={(e) =>
                      setEmailData((d) => ({ ...d, confirmPassword: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/90 text-gray-900"
                    autoComplete="new-password"
                  />
                </label>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="flex-1 py-3 rounded-lg border border-white/40 text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg font-semibold bg-white text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                >
                  {loading ? '…' : authMode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
