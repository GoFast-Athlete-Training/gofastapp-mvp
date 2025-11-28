'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🚀 SIGNUP: Starting Google sign-in...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('✅ SIGNUP: Google sign-in successful');

      // Get Firebase ID token for backend verification
      const firebaseToken = await result.user.getIdToken();
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls (Axios interceptor will use it)
      localStorage.setItem('firebaseToken', firebaseToken);

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNUP: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', result.user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || result.user.email || '');

      // Route based on profile completion (check gofastHandle - key indicator)
      if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNUP: Existing athlete with profile → Athlete Home');
        router.replace('/athlete-home');
      } else {
        console.log('✅ SIGNUP: New athlete or incomplete profile → Profile setup');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Google signup error:', err);
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

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNUP: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Route based on profile completion (check gofastHandle - key indicator)
      if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNUP: Existing athlete with profile → Athlete Home');
        router.replace('/athlete-home');
      } else {
        console.log('✅ SIGNUP: New athlete or incomplete profile → Profile setup');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Email signup error:', err);
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

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNIN: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNIN: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Route based on profile completion (check gofastHandle - key indicator)
      if (athlete.data?.gofastHandle) {
        console.log('✅ SIGNIN: Existing athlete with profile → Athlete Welcome');
        router.replace('/athlete-welcome');
      } else {
        console.log('✅ SIGNIN: New athlete or incomplete profile → Profile setup');
        router.replace('/athlete-create-profile');
      }
    } catch (err: any) {
      console.error('❌ SIGNIN: Email sign-in error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
    }
  };

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
            {authMode === 'signup' ? 'Welcome to GoFast!' : 'Welcome Back!'}
          </h1>
          <p className="text-xl text-white/80 mb-8">
            {authMode === 'signup' ? 'Join the community!' : 'Sign in to continue'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm">
            {error}
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
