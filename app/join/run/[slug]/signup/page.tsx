'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  reload,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { Calendar, Clock, MapPin } from 'lucide-react';

/**
 * /join/run/[slug]/signup
 *
 * Run-join-specific auth page. Signs up (or signs in) AND RSVPs the run
 * in a single sweep — no bounce back, no confirm loop.
 *
 * Flow: auth → hydrate/create athlete → RSVP → /gorun/[runId]
 *
 * ?mode=signin → starts in sign-in mode
 */
function JoinRunSignupContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const startInSignin = searchParams?.get('mode') === 'signin';

  const [run, setRun] = useState<any>(null);
  const [runLoading, setRunLoading] = useState(true);

  const [authMode, setAuthMode] = useState<'signup' | 'signin'>(startInSignin ? 'signin' : 'signup');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Fetch run for context — public, no auth
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/runs/public/${slug}`)
      .then(r => r.json())
      .then(data => { if (data.success && data.run) setRun(data.run); })
      .catch(() => {})
      .finally(() => setRunLoading(false));
  }, [slug]);

  // If already authenticated, skip straight to RSVP
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return;
      // User already authed — hydrate then RSVP
      try {
        const token = await user.getIdToken();
        const hydrateRes = await api.post('/athlete/hydrate', {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
          LocalStorageAPI.setFullHydrationModel({ athlete: hydrateRes.data.athlete });
        }
      } catch { /* already hydrated or no athlete yet — proceed anyway */ }
      await rsvpAndNavigate();
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * RSVP the run (if we have a run ID) then navigate to /gorun/[runId].
   * If run isn't loaded yet, just go to /gorun/[slug] and let that page sort it.
   */
  const rsvpAndNavigate = async (runData?: any) => {
    const r = runData ?? run;
    if (r?.id) {
      try {
        await api.post(`/runs/${r.id}/rsvp`, { status: 'going' });
      } catch (err: any) {
        // RSVP failed — still navigate, they can RSVP from the run page
        console.warn('RSVP failed after signup, continuing:', err?.response?.status);
      }
      router.replace(`/gorun/${r.id}`);
    } else {
      router.replace(`/gorun`);
    }
  };

  /** Shared post-auth handler: hydrate/create athlete → store → RSVP → navigate */
  const handlePostAuth = async (firebaseUser: any, firstName?: string, lastName?: string) => {
    const token = await firebaseUser.getIdToken(true);
    localStorage.setItem('firebaseToken', token);

    let athlete: any;

    try {
      const hydrateRes = await api.post('/athlete/hydrate', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
        athlete = { athleteId: hydrateRes.data.athlete.athleteId || hydrateRes.data.athlete.id, data: hydrateRes.data.athlete };
        LocalStorageAPI.setFullHydrationModel({ athlete: hydrateRes.data.athlete });
      } else throw new Error('bad hydrate');
    } catch {
      // New user — create athlete record
      const createRes = await api.post('/athlete/create', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      athlete = createRes.data;
    }

    // Store auth state
    localStorage.removeItem('fullHydrationModel');
    localStorage.setItem('firebaseId', firebaseUser.uid);
    localStorage.setItem('athleteId', athlete.athleteId);
    localStorage.setItem('email', athlete.data?.email || firebaseUser.email || '');

    await rsvpAndNavigate();
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await handlePostAuth(result.user);
    } catch (err: any) {
      console.error('Google auth error:', err);
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError('');
    try {
      let firebaseUser;
      if (authMode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, emailData.email, emailData.password);
        firebaseUser = result.user;
        const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
        if (displayName) {
          await updateProfile(firebaseUser, { displayName }).catch(() => {});
          await reload(firebaseUser).catch(() => {});
        }
      } else {
        await signInWithEmailAndPassword(auth, emailData.email, emailData.password);
        firebaseUser = auth.currentUser!;
      }
      await handlePostAuth(firebaseUser);
    } catch (err: any) {
      console.error('Email auth error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Sign in instead.');
        setAuthMode('signin');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  // Run summary for context
  const RunSummary = () => {
    if (runLoading || !run) return null;
    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = run.startTimeHour != null
      ? `${run.startTimeHour}:${String(run.startTimeMinute ?? 0).padStart(2, '0')} ${run.startTimePeriod || 'AM'}`
      : null;
    return (
      <div className="bg-white/10 rounded-xl p-4 mb-6 text-white/90 text-sm space-y-1.5">
        <div className="font-semibold text-white text-base mb-2">{run.title}</div>
        <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{formatDate(run.date)}</div>
        {time && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{time}</div>}
        <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{run.meetUpPoint}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700">
      <div className="max-w-md mx-auto px-4 py-10">

        <div className="text-center mb-6">
          <p className="text-orange-200 text-sm uppercase tracking-wide mb-1">You're joining</p>
          <h1 className="text-3xl font-bold text-white">
            {run?.runClub?.name ?? 'GoFast Run'}
          </h1>
        </div>

        <RunSummary />

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-white/70 text-sm mt-1">
              {authMode === 'signup' ? "We'll lock in your spot right after" : "Sign in to lock in your spot"}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-3 text-red-100 text-sm mb-4">
              {error}
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-3">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-50 transition disabled:opacity-50 shadow"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-white/20" />
                <span className="text-white/50 text-xs">or</span>
                <div className="flex-1 border-t border-white/20" />
              </div>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={loading}
                className="w-full py-3 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition disabled:opacity-50"
              >
                {authMode === 'signup' ? 'Sign up with Email' : 'Sign in with Email'}
              </button>

              <p className="text-white/60 text-xs text-center pt-1">
                {authMode === 'signup' ? (
                  <>Already have an account?{' '}
                    <button onClick={() => setAuthMode('signin')} className="text-white underline">Sign in</button>
                  </>
                ) : (
                  <>New to GoFast?{' '}
                    <button onClick={() => setAuthMode('signup')} className="text-white underline">Create account</button>
                  </>
                )}
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {authMode === 'signup' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="First name"
                    value={emailData.firstName}
                    onChange={e => setEmailData({ ...emailData, firstName: e.target.value })}
                    required
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={emailData.lastName}
                    onChange={e => setEmailData({ ...emailData, lastName: e.target.value })}
                    required
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                  />
                </div>
              )}
              <input
                type="email"
                placeholder="Email"
                value={emailData.email}
                onChange={e => setEmailData({ ...emailData, email: e.target.value })}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <input
                type="password"
                placeholder={authMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                value={emailData.password}
                onChange={e => setEmailData({ ...emailData, password: e.target.value })}
                required
                minLength={authMode === 'signup' ? 6 : undefined}
                disabled={loading}
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={emailData.confirmPassword}
                  onChange={e => setEmailData({ ...emailData, confirmPassword: e.target.value })}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  disabled={loading}
                  className="flex-1 py-3 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition disabled:opacity-50 shadow"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                      {authMode === 'signup' ? 'Creating…' : 'Signing in…'}
                    </span>
                  ) : (
                    authMode === 'signup' ? "Create & join →" : "Sign in & join →"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinRunSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    }>
      <JoinRunSignupContent />
    </Suspense>
  );
}
