'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Join-Crew Explainer Page
 * 
 * Route: /join/runcrew/[handle]/signup
 * 
 * Purpose: Explain why signup is required before joining
 * - Acknowledge user intent to join
 * - Explain community protection
 * - Set expectations
 * - Route to signup with join-crew mode
 */
export default function JoinCrewSignupExplainerPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;

  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingCrew, setFetchingCrew] = useState(true);
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
      setLoading(false);
      return;
    }

    async function fetchCrew() {
      try {
        setFetchingCrew(true);
        const response = await fetch(`/api/runcrew/public/handle/${handle}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('not_found');
          }
          throw new Error('Failed to fetch crew');
        }

        const data = await response.json();
        if (!data.success || !data.runCrew) {
          throw new Error('Crew not found');
        }

        setCrew(data.runCrew);
        setFetchingCrew(false);
      } catch (err: any) {
        console.error('❌ EXPLAINER: Error fetching crew:', err);
        if (err.message === 'not_found') {
          setError('not_found');
        } else {
          setError('error');
        }
        setFetchingCrew(false);
      }
    }

    fetchCrew();
  }, [handle]);

  // No redirects - just handle signup when user clicks button

  const handleGoogleSignUp = async () => {
    if (!crew) return;
    
    try {
      setLoading(true);
      setError(null);

      // Store join intent
      localStorage.setItem('runCrewJoinIntent', crew.id);
      localStorage.setItem('runCrewJoinIntentHandle', handle);

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Wait for auth state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get Firebase token (force refresh)
      const firebaseToken = await result.user.getIdToken(true);
      localStorage.setItem('firebaseToken', firebaseToken);
      
      // Ensure auth.currentUser is set (for API interceptor)
      if (!auth.currentUser) {
        throw new Error('Auth state not ready');
      }

      // Create/get athlete
      let athleteRes;
      try {
        athleteRes = await api.post('/athlete/create', {});
      } catch (createErr: any) {
        // If create fails with 500, athlete might already exist - try hydrate
        if (createErr?.response?.status === 500) {
          try {
            const hydrateRes = await api.post('/athlete/hydrate', {});
            if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
              athleteRes = {
                data: {
                  success: true,
                  athleteId: hydrateRes.data.athlete.athleteId || hydrateRes.data.athlete.id,
                  data: hydrateRes.data.athlete
                }
              };
            } else {
              throw createErr;
            }
          } catch (hydrateErr) {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }
      
      if (athleteRes?.data?.success || athleteRes?.data) {
        const athleteId = athleteRes.data.athleteId || athleteRes.data?.athlete?.athleteId || athleteRes.data?.athlete?.id;
        localStorage.setItem('firebaseId', result.user.uid);
        localStorage.setItem('athleteId', athleteId);
        localStorage.setItem('email', athleteRes.data?.data?.email || athleteRes.data?.athlete?.email || result.user.email || '');
        
        // Redirect to confirmation page IMMEDIATELY
        router.push(`/join/runcrew/${handle}/confirm`);
      } else {
        throw new Error('Failed to create/get athlete');
      }
    } catch (err: any) {
      console.error('❌ EXPLAINER: Google signup error:', err);
      setError(err.message || 'Failed to sign up. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!crew) return;
    
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
      setError(null);

      // Store join intent
      localStorage.setItem('runCrewJoinIntent', crew.id);
      localStorage.setItem('runCrewJoinIntentHandle', handle);

      const result = await createUserWithEmailAndPassword(auth, emailData.email, emailData.password);
      const user = result.user;

      // Update profile with display name
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Wait for auth state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get Firebase token (force refresh)
      const firebaseToken = await user.getIdToken(true);
      localStorage.setItem('firebaseToken', firebaseToken);
      
      // Ensure auth.currentUser is set (for API interceptor)
      if (!auth.currentUser) {
        throw new Error('Auth state not ready');
      }

      // Create/get athlete
      let athleteRes;
      try {
        athleteRes = await api.post('/athlete/create', {});
      } catch (createErr: any) {
        // If create fails with 500, athlete might already exist - try hydrate
        if (createErr?.response?.status === 500) {
          try {
            const hydrateRes = await api.post('/athlete/hydrate', {});
            if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
              athleteRes = {
                data: {
                  success: true,
                  athleteId: hydrateRes.data.athlete.athleteId || hydrateRes.data.athlete.id,
                  data: hydrateRes.data.athlete
                }
              };
            } else {
              throw createErr;
            }
          } catch (hydrateErr) {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }
      
      if (athleteRes?.data?.success || athleteRes?.data) {
        const athleteId = athleteRes.data.athleteId || athleteRes.data?.athlete?.athleteId || athleteRes.data?.athlete?.id;
        localStorage.setItem('firebaseId', user.uid);
        localStorage.setItem('athleteId', athleteId);
        localStorage.setItem('email', athleteRes.data?.data?.email || athleteRes.data?.athlete?.email || user.email || '');
        
        // Redirect to confirmation page IMMEDIATELY
        router.push(`/join/runcrew/${handle}/confirm`);
      } else {
        throw new Error('Failed to create/get athlete');
      }
    } catch (err: any) {
      console.error('❌ EXPLAINER: Email signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to sign up. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleNotNow = () => {
    router.push(`/join/runcrew/${handle}`);
  };

  // Loading state (fetching crew)
  if (fetchingCrew) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">RunCrew Not Found</h2>
          <p className="text-gray-600 mb-4">The RunCrew you're looking for doesn't exist.</p>
          <Link
            href="/runcrew"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  if (error || !crew) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Failed to load RunCrew data.</p>
          <Link
            href="/runcrew"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            {/* Crew Icon/Logo */}
            <div className="flex justify-center mb-4">
              {crew.logo ? (
                <img
                  src={crew.logo}
                  alt={crew.name || 'RunCrew'}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200"
                />
              ) : crew.icon ? (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
                  {crew.icon}
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
                  🏃
                </div>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              You're about to join {crew.name}
            </h1>
          </div>

          <div className="mb-6 text-left space-y-4 text-gray-700">
            <p className="text-base leading-relaxed">
              To protect our community and keep things safe, we ask everyone to create an account before joining a crew.
            </p>
            
            <p className="text-sm font-medium text-gray-900">This helps us:</p>
            <ul className="text-sm space-y-2 ml-4 list-disc">
              <li>prevent spam</li>
              <li>keep runs organized</li>
              <li>make sure members are real people</li>
            </ul>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                    <span>Signing up...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Sign up with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="text-gray-500 text-sm">or</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                Sign up with Email
              </button>
              
              <button
                onClick={handleNotNow}
                disabled={loading}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-3">
              <input
                type="text"
                placeholder="First Name"
                value={emailData.firstName}
                onChange={(e) => setEmailData({ ...emailData, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={emailData.lastName}
                onChange={(e) => setEmailData({ ...emailData, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                disabled={loading}
              />
              <input
                type="email"
                placeholder="Email Address"
                value={emailData.email}
                onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={emailData.password}
                onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                minLength={6}
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={emailData.confirmPassword}
                onChange={(e) => setEmailData({ ...emailData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                disabled={loading}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-3 px-6 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-xl font-semibold transition shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? 'Signing up...' : 'Sign Up'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

