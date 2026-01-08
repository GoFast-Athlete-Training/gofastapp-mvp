'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

const RUNCREW_JOIN_INTENT_HANDLE_KEY = 'runCrewJoinIntentHandle';

type SignupMode = 'default' | 'join-crew';

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
  const handle = localStorage.getItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
  if (!handle) return false;
  
  // Redirect back to front door (NO membership mutation here)
  router.replace(`/join/runcrew/${handle}`);
  return true;
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Detect signup mode from URL params
  const mode: SignupMode = (searchParams?.get('mode') === 'join-crew') ? 'join-crew' : 'default';
  const runCrewHandle = searchParams?.get('handle') || null;
  
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

          // Check if athlete exists - redirect to welcome (welcome will hydrate)
          try {
            const hydrateRes = await api.post('/athlete/hydrate');
            if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
              console.log('✅ SIGNUP PAGE: Existing athlete found, redirecting to welcome...');
              
              // Store auth data only
              localStorage.setItem('firebaseId', user.uid);
              localStorage.setItem('email', user.email || '');
              
              // Store hydration data and redirect to welcome (welcome will show RunCrew selector)
              if (hydrateRes.data?.athlete) {
                LocalStorageAPI.setFullHydrationModel({
                  athlete: hydrateRes.data.athlete,
                  weeklyActivities: hydrateRes.data.athlete.weeklyActivities || [],
                  weeklyTotals: hydrateRes.data.athlete.weeklyTotals || null,
                });
              }
              
              // Check for pending crew join intent - redirect to front door (NO auto-join)
              if (redirectToFrontDoorIfIntent(router)) return;
              
              // Join-crew mode: redirect to front door, default: redirect to welcome
              if (mode === 'join-crew' && runCrewHandle) {
                router.push(`/join/runcrew/${runCrewHandle}`);
              } else {
                router.push('/welcome');
              }
              return;
            }
          } catch (hydrateErr: any) {
            console.log('⚠️ SIGNUP PAGE: Hydrate failed, trying create...', hydrateErr.response?.status);
            // If hydrate fails, try create (might be a new user)
          try {
            const createRes = await api.post('/athlete/create', {});
            if (createRes.data?.success) {
              const athlete = createRes.data;
              console.log('✅ SIGNUP PAGE: Athlete created/found via create endpoint');
              
              localStorage.setItem('firebaseId', user.uid);
              localStorage.setItem('athleteId', athlete.athleteId);
              localStorage.setItem('email', athlete.data?.email || user.email || '');

              // Check for pending crew join intent - redirect to front door (NO auto-join)
              if (redirectToFrontDoorIfIntent(router)) return;

              // Join-crew mode: redirect to front door, default: route based on profile
              if (mode === 'join-crew' && runCrewHandle) {
                router.replace(`/join/runcrew/${runCrewHandle}`);
              } else if (athlete.data?.gofastHandle) {
                router.replace('/welcome');
              } else {
                router.replace('/athlete-create-profile');
              }
              return;
              }
            } catch (createErr: any) {
              console.error('❌ SIGNUP PAGE: Both hydrate and create failed', createErr.response?.status);
              // Stay on signup page, let user try again
            }
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

      // Get Firebase ID token for backend verification
      const firebaseToken = await result.user.getIdToken();
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls (Axios interceptor will use it)
      localStorage.setItem('firebaseToken', firebaseToken);

      // Try to create/get athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      let res;
      let athlete;
      
      try {
        res = await api.post('/athlete/create', {});
        console.log('✅ SIGNUP: Backend API response:', res.data);
        athlete = res.data;
      } catch (createErr: any) {
        // If create fails with 500, try hydrate instead (user might already exist)
        if (createErr?.response?.status === 500) {
          console.log('⚠️ SIGNUP: Create failed with 500, trying hydrate...');
          // Athlete might exist - redirect to athlete-home
          console.log('✅ SIGNUP: Athlete might exist, redirecting to athlete-home');
          
          // Check for pending crew join intent - redirect to front door (NO auto-join)
          if (redirectToFrontDoorIfIntent(router)) return;
          
          // Join-crew mode: redirect to front door, default: redirect to welcome
          if (mode === 'join-crew' && runCrewHandle) {
            router.push(`/join/runcrew/${runCrewHandle}`);
          } else {
            router.push('/welcome');
          }
          return;
        } else {
          throw createErr; // Re-throw if not a 500 error
        }
      }

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', result.user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || result.user.email || '');

      // Check for pending crew join intent - redirect to front door (NO auto-join)
      if (redirectToFrontDoorIfIntent(router)) return;

      // Route based on profile completion (check gofastHandle - key indicator)
      if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNUP: Existing athlete with profile → Welcome');
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
        await updateProfile(user, { displayName });
      }
      console.log('✅ SIGNUP: Email signup successful');

      // Get Firebase ID token for backend verification
      const firebaseToken = await user.getIdToken();
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls
      localStorage.setItem('firebaseToken', firebaseToken);

      // Try to create/get athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      let res;
      let athlete;
      
      try {
        res = await api.post('/athlete/create', {});
        console.log('✅ SIGNUP: Backend API response:', res.data);
        athlete = res.data;
      } catch (createErr: any) {
        // If create fails with 500, try hydrate instead (user might already exist)
        if (createErr?.response?.status === 500) {
          console.log('⚠️ SIGNUP: Create failed with 500, trying hydrate...');
          // Athlete might exist - redirect to profile creation
          console.log('✅ SIGNUP: Athlete might exist, redirecting to create profile');
          
          // Check for pending crew join intent - redirect to front door (NO auto-join)
          if (redirectToFrontDoorIfIntent(router)) return;
          
          // Join-crew mode: redirect to front door, default: redirect to profile creation
          if (mode === 'join-crew' && runCrewHandle) {
            router.push(`/join/runcrew/${runCrewHandle}`);
          } else {
            router.push('/athlete-create-profile');
          }
          return;
        } else {
          throw createErr; // Re-throw if not a 500 error
        }
      }

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Check for pending crew join intent - redirect to front door (NO auto-join)
      if (redirectToFrontDoorIfIntent(router)) return;

      // Route based on profile completion (check gofastHandle - key indicator)
      if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNUP: Existing athlete with profile → Welcome');
        router.replace('/welcome');
      } else {
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

      // Try to create/get athlete - empty body, token auto-injected
      console.log('🌐 SIGNIN: Calling backend API: /athlete/create');
      let res;
      let athlete;
      
      try {
        res = await api.post('/athlete/create', {});
        console.log('✅ SIGNIN: Backend API response:', res.data);
        athlete = res.data;
      } catch (createErr: any) {
        // If create fails with 500, try hydrate instead (user might already exist)
        if (createErr?.response?.status === 500) {
          console.log('⚠️ SIGNIN: Create failed with 500, trying hydrate...');
          try {
            const hydrateRes = await api.post('/athlete/hydrate');
            if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
              console.log('✅ SIGNIN: Hydrate succeeded, using hydrated athlete');
              athlete = {
                success: true,
                athleteId: hydrateRes.data.athlete.athleteId || hydrateRes.data.athlete.id,
                data: hydrateRes.data.athlete
              };
            } else {
              throw createErr; // Re-throw original error if hydrate also fails
            }
          } catch (hydrateErr: any) {
            console.error('❌ SIGNIN: Both create and hydrate failed');
            throw createErr; // Throw original create error
          }
        } else {
          throw createErr; // Re-throw if not a 500 error
        }
      }

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Check for pending crew join intent - redirect to front door (NO auto-join)
      if (redirectToFrontDoorIfIntent(router)) return;

      // Join-crew mode: redirect to front door, default: route based on profile
      if (mode === 'join-crew' && runCrewHandle) {
        router.replace(`/join/runcrew/${runCrewHandle}`);
      } else if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNIN: Existing athlete with profile → Welcome');
        router.replace('/welcome');
      } else {
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
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
        <div className="text-center">
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
          <p className="text-xl text-white/80 mb-8">
            {mode === 'join-crew'
              ? 'Create your account to join this crew'
              : authMode === 'signup'
              ? 'Join the community!'
              : 'Sign in to continue'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm">
            {error}
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm">
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
