'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen,
  CalendarDays,
  Footprints,
  Layout,
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  ATHLETE_PROGRAM_DESTINATION,
  athleteProgramProfileCreatePath,
} from '@/lib/athlete-program-paths';

const JOURNEY_STEPS = [
  {
    step: 1,
    title: 'Join GoFast',
    body: 'Create or sign into your GoFast account — the same app for training, runs, and community.',
    active: true,
  },
  {
    step: 2,
    title: 'Create your basic athlete profile',
    body: 'Name, city, photo, and @handle. This is your GoFast identity — not your finished public community page.',
    active: false,
  },
  {
    step: 3,
    title: 'Choose GoFast With Me',
    body: 'After your profile, enter GoFast With Me, choose I\'m an athlete, then tap Ready to get started.',
    active: false,
  },
  {
    step: 4,
    title: 'Build in Studio',
    body: 'Set up your landing page, daily log, runs & training, tips, and community management.',
    active: false,
    studioBins: [
      { icon: Layout, label: 'Landing page' },
      { icon: Users, label: 'Daily log' },
      { icon: CalendarDays, label: 'Runs & Training' },
      { icon: BookOpen, label: 'Tips & Thinking' },
      { icon: LayoutDashboard, label: 'Community Management' },
    ],
  },
  {
    step: 5,
    title: 'Publish and communicate',
    body: 'Share your public link, post updates, host GoRuns, and welcome followers into Chatter.',
    active: false,
  },
] as const;

async function bootstrapAthleteAfterAuth(): Promise<{
  athleteId: string;
  gofastHandle: string | null;
}> {
  let athleteRes;
  try {
    const meRes = await api.get('/athlete/me');
    if (meRes.data?.success && meRes.data?.athleteId) {
      const profRes = await api.get(`/athlete/${meRes.data.athleteId}`);
      athleteRes = {
        athleteId: meRes.data.athleteId as string,
        athlete: profRes.data?.athlete,
      };
    } else {
      throw new Error('Invalid me response');
    }
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status !== 404) throw e;
    const createRes = await api.post('/athlete/create', {
      onboardingIntent: 'athlete-program',
    });
    if (!createRes.data?.success && !createRes.data?.athleteId) throw e;
    athleteRes = {
      athleteId: createRes.data.athleteId || createRes.data.data?.id,
      athlete: createRes.data.data || createRes.data.athlete,
    };
  }

  const athleteId = athleteRes.athleteId;
  if (!athleteId) throw new Error('Failed to get athlete ID');

  localStorage.removeItem('athlete');
  localStorage.removeItem('athleteProfile');
  localStorage.removeItem('fullHydrationModel');
  LocalStorageAPI.setAthleteId(athleteId);

  return {
    athleteId,
    gofastHandle: athleteRes.athlete?.gofastHandle ?? null,
  };
}

function routeAfterAuth(
  router: ReturnType<typeof useRouter>,
  gofastHandle: string | null
) {
  if (gofastHandle?.trim()) {
    router.replace(ATHLETE_PROGRAM_DESTINATION);
    return;
  }
  router.replace(athleteProgramProfileCreatePath());
}

function JourneyExplainer({ authMode }: { authMode: 'signup' | 'signin' }) {
  return (
    <section className="mb-8" aria-label="Your path through GoFast">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-700 mb-1">
        Your path through GoFast
      </p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        {authMode === 'signup'
          ? 'You are starting at step 1'
          : 'Pick up where you left off'}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        {authMode === 'signup'
          ? 'Joining GoFast is the first step — your basic profile and GoFast With Me setup come next, inside the app.'
          : 'Sign in to continue your profile, GoFast With Me setup, or Studio work. You will not recreate an existing profile.'}
      </p>

      <ol className="space-y-3">
        {JOURNEY_STEPS.map((item) => {
          const isCurrent = authMode === 'signup' && item.step === 1;
          return (
            <li
              key={item.step}
              className={`rounded-xl border p-4 ${
                isCurrent
                  ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-200'
                  : 'border-gray-200 bg-gray-50/80'
              }`}
            >
              <div className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isCurrent
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {item.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">{item.body}</p>
                  {'studioBins' in item && item.studioBins ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.studioBins.map(({ icon: Icon, label }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700"
                        >
                          <Icon className="h-3 w-3 shrink-0 text-sky-600" aria-hidden />
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.step === 3 ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white border border-violet-200 px-2 py-1 text-[10px] font-medium text-violet-800">
                      <Footprints className="h-3 w-3" aria-hidden />
                      I&apos;m an athlete
                      <span className="text-gray-400">·</span>
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Ready to get started
                    </p>
                  ) : null}
                  {item.step === 5 ? (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-white border border-orange-200 px-2 py-1 text-[10px] font-medium text-orange-800">
                      <MessageCircle className="h-3 w-3" aria-hidden />
                      Chatter with followers
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function AthleteProgramSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
        const { gofastHandle } = await bootstrapAthleteAfterAuth();
        routeAfterAuth(router, gofastHandle);
      } catch {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  const afterAuth = async (uid: string, email: string | null) => {
    const { gofastHandle } = await bootstrapAthleteAfterAuth();
    localStorage.setItem('firebaseId', uid);
    localStorage.setItem('email', email || '');
    routeAfterAuth(router, gofastHandle);
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = await signInWithGoogle();
      const token = await user.getIdToken(true);
      localStorage.setItem('firebaseToken', token);
      await afterAuth(user.uid, user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      let user;
      if (authMode === 'signup') {
        const result = await createUserWithEmailAndPassword(
          auth,
          emailData.email,
          emailData.password
        );
        user = result.user;
        const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
        if (displayName) {
          await updateProfile(user, { displayName });
          await reload(user);
        }
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          emailData.email,
          emailData.password
        );
        user = result.user;
      }
      const token = await user.getIdToken(true);
      localStorage.setItem('firebaseToken', token);
      await afterAuth(user.uid, user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-sky-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <div className="text-center mb-6">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={56}
              height={56}
              className="mx-auto rounded-full mb-4"
            />
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 mb-2">
              GoFast Amateur Athlete Program
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              {authMode === 'signup' ? 'Join GoFast' : 'Welcome back'}
            </h1>
          </div>

          <JourneyExplainer authMode={authMode} />

          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {authMode === 'signup' ? 'Step 1 — join GoFast' : 'Sign in to continue'}
            </p>

            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {!showEmailForm ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGoogle()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? 'Joining…' : authMode === 'signup' ? 'Join with Google' : 'Sign in with Google'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  disabled={loading}
                  className="w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {authMode === 'signup' ? 'Join with email' : 'Sign in with email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode((m) => (m === 'signup' ? 'signin' : 'signup'));
                    setError(null);
                  }}
                  className="w-full text-sm text-gray-600 hover:text-gray-900"
                >
                  {authMode === 'signup'
                    ? 'Already on GoFast? Sign in'
                    : 'New to GoFast? Create an account'}
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
                {authMode === 'signup' ? (
                  <>
                    <input
                      type="text"
                      placeholder="First name"
                      value={emailData.firstName}
                      onChange={(e) => setEmailData({ ...emailData, firstName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={emailData.lastName}
                      onChange={(e) => setEmailData({ ...emailData, lastName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                      required
                    />
                  </>
                ) : null}
                <input
                  type="email"
                  placeholder="Email"
                  value={emailData.email}
                  onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={emailData.password}
                  onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                  required
                  minLength={6}
                />
                {authMode === 'signup' ? (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={emailData.confirmPassword}
                    onChange={(e) =>
                      setEmailData({ ...emailData, confirmPassword: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    required
                    minLength={6}
                  />
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="flex-1 rounded-xl bg-gray-200 py-3 text-sm font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {loading
                      ? 'Joining…'
                      : authMode === 'signup'
                        ? 'Join GoFast'
                        : 'Sign in'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-gray-500">
            <Link
              href="https://www.gofastcrushgoals.com/athlete-program-start.html"
              className="text-sky-700 hover:text-sky-800"
            >
              Back to program overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
