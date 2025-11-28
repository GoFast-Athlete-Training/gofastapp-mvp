'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    // Show splash for 1 second, then check auth
    const timer = setTimeout(() => {
      setShowSplash(false);
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setIsAuthenticated(!!user);
        setIsLoading(false);
        
        if (user) {
          // Verify token is valid for current Firebase project
          try {
            const token = await user.getIdToken();
            // If token retrieval succeeds, user is valid for current project
            console.log('✅ Root: Valid Firebase user detected, redirecting to welcome');
            router.push('/athlete-welcome');
          } catch (error: any) {
            // Token invalid (likely from old Firebase project) - clear everything
            console.warn('⚠️ Root: Invalid token detected, clearing stale auth state');
            console.warn('⚠️ Root: Error:', error?.message);
            
            // Sign out to clear Firebase auth state
            try {
              await auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            
            // Clear localStorage
            if (typeof window !== 'undefined') {
              localStorage.clear();
            }
            
            // Reset state to show sign-in UI
            setIsAuthenticated(false);
            setIsLoading(false);
          }
        }
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  const handleGoogleSignUp = async () => {
    try {
      console.log('🚀 Root: handleGoogleSignUp called');
      setIsSigningUp(true);
      setError('');
      console.log('🚀 Root: Calling signInWithGoogle...');
      await signInWithGoogle();
      console.log('✅ Root: signInWithGoogle completed, waiting for auth state change');
      // onAuthStateChanged will handle the redirect
    } catch (error: any) {
      console.error('❌ Root: Sign up error:', error);
      console.error('❌ Root: Error code:', error.code);
      console.error('❌ Root: Error message:', error.message);
      setError(error.message || 'Failed to sign up with Google');
      setIsSigningUp(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
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
      setIsSigningUp(true);
      setError('');
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      await signUpWithEmail(emailData.email, emailData.password, displayName);
      // onAuthStateChanged will handle the redirect
    } catch (error: any) {
      console.error('Sign up error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(error.message || 'Failed to sign up. Please try again.');
      }
      setIsSigningUp(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSigningUp(true);
      setError('');
      await signInWithEmail(emailData.email, emailData.password);
      // onAuthStateChanged will handle the redirect
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Failed to sign in. Please check your credentials.');
      setIsSigningUp(false);
    }
  };

  // Show splash screen
  if (showSplash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Image
            src="/logo.jpg"
            alt="GoFast Logo"
            width={192}
            height={192}
            className="w-48 h-48 rounded-full shadow-2xl mx-auto object-cover"
            priority
          />
        </div>
      </div>
    );
  }

  // Show sign-in UI (fallback)
  if (showSignIn && !isAuthenticated && !isLoading) {
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
              Welcome Back!
            </h1>
            <p className="text-xl text-white/80 mb-8">
              Sign in to continue your journey
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={emailData.email}
              onChange={(e) => setEmailData({...emailData, email: e.target.value})}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              required
              disabled={isSigningUp}
            />
            <input
              type="password"
              placeholder="Password"
              value={emailData.password}
              onChange={(e) => setEmailData({...emailData, password: e.target.value})}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              required
              disabled={isSigningUp}
            />
            <button
              type="submit"
              disabled={isSigningUp}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-sky-600 hover:to-blue-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningUp ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <p className="text-white/80 text-sm text-center">
            Don't have an account?{' '}
            <button
              onClick={() => setShowSignIn(false)}
              className="text-sky-200 font-semibold hover:underline"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Show sign-up UI (primary) if not authenticated
  if (!isAuthenticated && !isLoading) {
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
              Welcome to GoFast!
            </h1>
          </div>

          {!showEmailForm ? (
            <>
              {/* Google Sign Up Button */}
              <button
                onClick={handleGoogleSignUp}
                disabled={isSigningUp}
                className="w-full bg-white text-gray-800 py-4 px-6 rounded-xl font-semibold hover:bg-gray-100 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSigningUp ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-800"></div>
                    <span>Signing up...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Sign up with Google</span>
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
                disabled={isSigningUp}
                className="w-full bg-white/10 border-2 border-white/30 text-white py-4 px-6 rounded-xl font-semibold hover:bg-white/20 transition shadow-lg disabled:opacity-50"
              >
                Sign up with Email
              </button>
            </>
          ) : (
            <>
              {/* Email Sign Up Form */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-100 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">First Name *</label>
                    <input
                      type="text"
                      required
                      value={emailData.firstName}
                      onChange={(e) => setEmailData({...emailData, firstName: e.target.value})}
                      className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                      placeholder="John"
                      disabled={isSigningUp}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={emailData.lastName}
                      onChange={(e) => setEmailData({...emailData, lastName: e.target.value})}
                      className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                      placeholder="Doe"
                      disabled={isSigningUp}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={emailData.email}
                    onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    placeholder="john@example.com"
                    disabled={isSigningUp}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={emailData.password}
                    onChange={(e) => setEmailData({...emailData, password: e.target.value})}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    placeholder="Minimum 6 characters"
                    disabled={isSigningUp}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={emailData.confirmPassword}
                    onChange={(e) => setEmailData({...emailData, confirmPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    placeholder="Confirm your password"
                    disabled={isSigningUp}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailForm(false);
                      setError('');
                    }}
                    className="flex-1 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition"
                    disabled={isSigningUp}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSigningUp}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                  >
                    {isSigningUp ? 'Signing up...' : 'Sign Up'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Already have account - soft fallback */}
          <p className="text-white/80 text-sm text-center">
            Already have an account?{' '}
            <button
              onClick={() => {
                setShowSignIn(true);
                setShowEmailForm(false);
                setError('');
              }}
              className="text-sky-200 font-semibold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Loading state (checking auth)
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/80">Loading...</p>
      </div>
    </div>
  );
}
