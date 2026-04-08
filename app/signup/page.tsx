'use client';


import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, reload } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

type SignupMode = 'default' | 'join-crew';

async function loadOrCreateAthlete(opts?: { onboardingIntent?: string }) {
  try {
    const meRes = await api.get('/athlete/me');
    if (meRes.data?.success && meRes.data?.athleteId) {
      const aid = meRes.data.athleteId as string;
      const profRes = await api.get(`/athlete/${aid}`);
      return {
        success: true,
        athleteId: aid,
        data: profRes.data?.athlete,
      };
    }
  } catch (e: any) {
    if (e?.response?.status !== 404) throw e;
  }
  const res = await api.post('/athlete/create', {
    onboardingIntent: opts?.onboardingIntent,
  });
  return res.data;
}

/**
 * Check if user has a pending RunCrew join intent
 * If so, redirect back to front door page (NO auto-join)
 * 
 * This follows the authoritative UX flow:
 * - User clicks Join → stored intent → signup → return to front door
 * - Front door will show explicit confirmation UI
 * - Only then will membership be created
 */
function redirectToFrontDoorIfIntent(router: any): boolean {
  const handle = LocalStorageAPI.getRunCrewJoinIntentHandle();
  if (!handle) return false;
  
  // Redirect back to front door (NO membership mutation here)
  router.replace(`/join/runcrew/${handle}`);
  return true;
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Detect signup mode from URL params
  const mode: SignupMode = (searchParams?.get('mode') === 'join-crew') ? 'join-crew' : 'default';
  const runCrewHandle = searchParams?.get('handle') || null;
  
  // Detect club leader intent from URL param (passed from splash page)
  const isClubLeaderIntent = searchParams?.get('intent') === 'club-leader';
  
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
  
  // Fetch crew name for join-crew mode
  const [crewName, setCrewName] = useState<string | null>(null);
  
  useEffect(() => {
    if (mode === 'join-crew' && runCrewHandle) {
      // Fetch crew name for display
      fetch(`/api/runcrew/public/handle/${runCrewHandle}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.runCrew) {
            setCrewName(data.runCrew.name);
          }
        })
        .catch(err => console.error('Error fetching crew name:', err));
    }
  }, [mode, runCrewHandle]);

  // Check if user is already authenticated on page load
  useEffect(() => {
    console.log('🔍 SIGNUP PAGE: Checking authentication state...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('✅ SIGNUP PAGE: User already authenticated, checking athlete...');
        try {
          // Get fresh token
          const firebaseToken = await user.getIdToken();
          localStorage.setItem('firebaseToken', firebaseToken);

          try {
            const athlete = await loadOrCreateAthlete({
              onboardingIntent: isClubLeaderIntent ? 'CLUB_LEADER' : undefined,
            });
            if (athlete?.success && athlete.athleteId) {
              console.log('✅ SIGNUP PAGE: Athlete resolved, redirecting...');
              localStorage.setItem('firebaseId', user.uid);
              localStorage.setItem('email', user.email || '');
              LocalStorageAPI.setAthleteId(athlete.athleteId);

              if (redirectToFrontDoorIfIntent(router)) return;

              if (mode === 'join-crew' && runCrewHandle) {
                router.push(`/join/runcrew/${runCrewHandle}`);
              } else if (athlete.data?.gofastHandle) {
                router.push('/welcome');
              } else {
                router.replace('/athlete-create-profile');
              }
              return;
            }
          } catch (authCheckErr: any) {
            console.error('❌ SIGNUP PAGE: loadOrCreateAthlete failed', authCheckErr?.response?.status);
          }
        } catch (err: any) {
          console.error('❌ SIGNUP PAGE: Error checking athlete:', err);
          // Stay on signup page
        }
      } else {
        console.log('ℹ️ SIGNUP PAGE: No authenticated user - showing signup form');
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');

      console.log('🚀 SIGNUP: Starting Google sign-in...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('✅ SIGNUP: Google sign-in successful');

      // Get Firebase ID token for backend verification - force refresh to ensure latest profile data
      const firebaseToken = await result.user.getIdToken(true);
      console.log('🔐 SIGNUP: Firebase token obtained (force refreshed)');

      // Store Firebase token for API calls (Axios interceptor will use it)
      localStorage.setItem('firebaseToken', firebaseToken);

      console.log('🌐 SIGNUP: Resolving athlete (me or create)...');
      const athlete = await loadOrCreateAthlete();

      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      localStorage.removeItem('athlete');
      localStorage.removeItem('athleteProfile');
      localStorage.removeItem('fullHydrationModel');
      localStorage.removeItem('weeklyActivities');
      localStorage.removeItem('weeklyTotals');

      localStorage.setItem('firebaseId', result.user.uid);
      LocalStorageAPI.setAthleteId(athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || result.user.email || '');

      // Check for pending crew join intent - redirect to front door (NO auto-join)
      if (redirectToFrontDoorIfIntent(router)) return;

      // Join-crew mode: redirect to front door, default: route to welcome (which checks role)
      if (mode === 'join-crew' && runCrewHandle) {
        router.replace(`/join/runcrew/${runCrewHandle}`);
      } else if (athlete.data?.gofastHandle) {
        // Existing athlete with profile - route to welcome (will check role and route accordingly)
        console.log('✅ SIGNUP: Existing athlete with profile → Welcome (role-aware routing)');
        router.replace('/welcome');
      } else {
        console.log('✅ SIGNUP: New athlete or incomplete profile → Create Profile');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Google signup error:', err);
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNUP: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      setError(err.message || 'Signup error');
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match!");
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

      console.log('🚀 SIGNUP: Starting email signup...');
      const result = await createUserWithEmailAndPassword(auth, emailData.email, emailData.password);
      const user = result.user;

      // Update profile with display name
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      if (displayName) {
        try {
          await updateProfile(user, { displayName });
          // Reload user object to get updated profile data from Firebase
          await reload(user);
          console.log('✅ SIGNUP: Profile updated and user reloaded. DisplayName:', user.displayName);
        } catch (profileError) {
          console.warn('⚠️ SIGNUP: Failed to update profile:', profileError);
          // Continue anyway - the API can still use firstName/lastName from the request if needed
        }
      }
      console.log('✅ SIGNUP: Email signup successful');

      // Get Firebase ID token for backend verification - force refresh to get updated displayName
      const firebaseToken = await user.getIdToken(true);
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls
      localStorage.setItem('firebaseToken', firebaseToken);

      console.log('🌐 SIGNUP: Resolving athlete (me or create)...');
      const athlete = await loadOrCreateAthlete();

      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      localStorage.removeItem('athlete');
      localStorage.removeItem('athleteProfile');
      localStorage.removeItem('fullHydrationModel');
      localStorage.removeItem('weeklyActivities');
      localStorage.removeItem('weeklyTotals');

      localStorage.setItem('firebaseId', user.uid);
      LocalStorageAPI.setAthleteId(athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      if (redirectToFrontDoorIfIntent(router)) return;

      if (mode === 'join-crew' && runCrewHandle) {
        router.replace(`/join/runcrew/${runCrewHandle}`);
      } else if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNUP: Existing athlete with profile → Welcome (role-aware routing)');
        router.replace('/welcome');
      } else {
        // No profile - go to profile creation
        // DON'T store athlete data - localStorage is already cleared above
        // Profile creation page will only use Firebase data (email, displayName) as fallback
        console.log('✅ SIGNUP: New athlete or incomplete profile → Create Profile');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Email signup error:', err);
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNUP: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
        setAuthMode('signin');
      } else {
        setError(err.message || 'Failed to sign up. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleEmailSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');

      console.log('🚀 SIGNIN: Starting email sign-in...');
      await signInWithEmailAndPassword(auth, emailData.email, emailData.password);
      console.log('✅ SIGNIN: Email sign-in successful');

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user after sign-in');
      }

      // Get Firebase ID token for backend verification
      const firebaseToken = await user.getIdToken();
      console.log('🔐 SIGNIN: Firebase token obtained');

      // Store Firebase token for API calls
      localStorage.setItem('firebaseToken', firebaseToken);

      console.log('🌐 SIGNIN: Resolving athlete (me or create)...');
      const athlete = await loadOrCreateAthlete();

      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      localStorage.removeItem('athlete');
      localStorage.removeItem('athleteProfile');
      localStorage.removeItem('fullHydrationModel');
      localStorage.removeItem('weeklyActivities');
      localStorage.removeItem('weeklyTotals');

      localStorage.setItem('firebaseId', user.uid);
      LocalStorageAPI.setAthleteId(athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      if (redirectToFrontDoorIfIntent(router)) return;

      if (mode === 'join-crew' && runCrewHandle) {
        router.replace(`/join/runcrew/${runCrewHandle}`);
      } else if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNIN: Existing athlete with profile → Welcome (role-aware routing)');
        router.replace('/welcome');
      } else {
        // No profile - go to profile creation
        // DON'T store athlete data - localStorage is already cleared above
        // Profile creation page will only use Firebase data (email, displayName) as fallback
        console.log('✅ SIGNIN: New athlete or incomplete profile → Create Profile');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNIN: Email sign-in error:', err);
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNIN: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-sky-100">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Explainer Section - only show in default mode for signup */}
        {mode === 'default' && authMode === 'signup' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 mb-6 border border-white/20">
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Welcome to GoFast
              </h1>
              <p className="text-lg text-white/90 max-w-2xl mx-auto">
                Connect with runners, join crews, and achieve your goals together
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Train</h3>
                  <p className="text-sm text-white/80">
                    Build a training plan around your goal race and pace
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">
                  👥
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Find others</h3>
                  <p className="text-sm text-white/80">
                    Join RunCrews and RSVP to community runs near you
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">
                  🏁
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Find races</h3>
                  <p className="text-sm text-white/80">
                    Browse local races and lock in your next goal
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">
                  ⏱️
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">PR</h3>
                  <p className="text-sm text-white/80">
                    Track your pace over time and watch yourself get faster
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signup Form */}
        <div className="max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
            <div className="text-center mb-8">
              {mode === 'default' && authMode === 'signup' ? (
                <>
                  <h2 className="text-3xl font-bold text-white mb-2">Ready to get started?</h2>
                  <p className="text-lg text-white/90">
                    Create your free account and join the community
                  </p>
                </>
              ) : (
                <>
                  <Image
                    src="/logo.jpg"
                    alt="GoFast Logo"
                    width={128}
                    height={128}
                    className="w-32 h-32 rounded-full shadow-xl mx-auto mb-6 object-cover"
                    priority
                  />
                  <h1 className="text-4xl font-bold text-white mb-2">
                    {mode === 'join-crew' && crewName
                      ? `Join ${crewName}`
                      : authMode === 'signup'
                      ? 'Welcome to GoFast!'
                      : 'Welcome Back!'}
                  </h1>
                  <p className="text-xl text-white/90 mb-8">
                    {mode === 'join-crew'
                      ? 'Create your account to join this crew'
                      : authMode === 'signup'
                      ? 'Join the community!'
                      : 'Sign in to continue'}
                  </p>
                </>
              )}
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
                {/* Google Sign Up Button */}
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-6 border-2 border-white/30 rounded-lg shadow-lg text-base font-medium text-white bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing {authMode === 'signup' ? 'up' : 'in'}...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Sign {authMode === 'signup' ? 'up' : 'in'} with Google</span>
                </>
              )}
            </button>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t border-white/30"></div>
                  <span className="text-white/60 text-sm">or</span>
                  <div className="flex-1 border-t border-white/30"></div>
                </div>

                {/* Email Sign Up Option */}
                <button
                  onClick={() => setShowEmailForm(true)}
                  disabled={loading}
                  className="w-full bg-white/10 border-2 border-white/30 text-white py-4 px-6 rounded-xl font-semibold hover:bg-white/20 transition shadow-lg disabled:opacity-50"
                >
                  Sign {authMode === 'signup' ? 'up' : 'in'} with Email
                </button>

                {/* Toggle between signup and signin */}
                <p className="text-white/80 text-sm text-center">
                  {authMode === 'signup' ? (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={() => setAuthMode('signin')}
                        className="text-blue-300 font-semibold hover:underline"
                      >
                        Sign In
                      </button>
                    </>
                  ) : (
                    <>
                      Don't have an account?{' '}
                      <button
                        onClick={() => setAuthMode('signup')}
                        className="text-blue-300 font-semibold hover:underline"
                      >
                        Sign Up
                      </button>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                {/* Email Form */}
                <form onSubmit={authMode === 'signup' ? handleEmailSignup : handleEmailSignin} className="space-y-4">
                  {authMode === 'signup' && (
                    <>
                      <input
                        type="text"
                        placeholder="First Name"
                        value={emailData.firstName}
                        onChange={(e) => setEmailData({ ...emailData, firstName: e.target.value })}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                        required
                        disabled={loading}
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={emailData.lastName}
                        onChange={(e) => setEmailData({ ...emailData, lastName: e.target.value })}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                        required
                        disabled={loading}
                      />
                    </>
                  )}
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={emailData.email}
                    onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    required
                    disabled={loading}
                  />
                  <input
                    type="password"
                    placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
                    value={emailData.password}
                    onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    required
                    minLength={authMode === 'signup' ? 6 : undefined}
                    disabled={loading}
                  />
                  {authMode === 'signup' && (
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={emailData.confirmPassword}
                      onChange={(e) => setEmailData({ ...emailData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                      required
                      disabled={loading}
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      disabled={loading}
                      className="flex-1 bg-white/10 border border-white/30 text-white py-3 px-6 rounded-xl font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-sky-600 hover:to-blue-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          {authMode === 'signup' ? 'Signing up...' : 'Signing in...'}
                        </span>
                      ) : (
                        authMode === 'signup' ? 'Sign Up →' : 'Sign In →'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-sky-100">Loading...</p>
        </div>
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}
