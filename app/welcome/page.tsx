'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

const SESSION_GATE_KEY = 'gofast_uid_resolved';

function getSessionGate(): { uid: string; athleteId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_GATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionGate(uid: string, athleteId: string) {
  try {
    sessionStorage.setItem(SESSION_GATE_KEY, JSON.stringify({ uid, athleteId }));
  } catch {}
}

function clearSessionGate() {
  try {
    sessionStorage.removeItem(SESSION_GATE_KEY);
  } catch {}
}

/**
 * Welcome — auth gate: resolve athleteId once per session, store it, redirect to athlete-home.
 * Uses a sessionStorage gate so remounts (e.g. bounced from athlete-home on a data error)
 * short-circuit instantly without re-running /athlete/me.
 */
export default function WelcomePage() {
  const router = useRouter();
  const hasProcessedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasProcessedRef.current) {
        return;
      }

      if (!firebaseUser) {
        hasProcessedRef.current = true;
        clearSessionGate();
        router.replace('/signup');
        return;
      }

      // ── Session gate: if we already resolved this uid+athleteId this session, skip /athlete/me ──
      const storedAthleteId = LocalStorageAPI.getAthleteId();
      const gate = getSessionGate();
      if (gate && gate.uid === firebaseUser.uid && gate.athleteId === storedAthleteId && storedAthleteId) {
        hasProcessedRef.current = true;
        router.replace('/athlete-home');
        return;
      }

      hasProcessedRef.current = true;

      try {
        const token = await firebaseUser.getIdToken();
        const response = await api.get('/athlete/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data?.success && response.data?.athleteId) {
          LocalStorageAPI.setAthleteId(response.data.athleteId);
          setSessionGate(firebaseUser.uid, response.data.athleteId);
          router.replace('/athlete-home');
          return;
        }

        console.error('❌ Welcome: Invalid response from /athlete/me');
        setError('Failed to load athlete data');
        setIsLoading(false);
      } catch (error: any) {
        console.error('❌ Welcome: /athlete/me failed:', error?.response?.status || error?.message);

        if (error?.response?.status === 404) {
          try {
            const createRes = await api.post('/athlete/create', {});
            if (createRes.data?.success && createRes.data?.athleteId) {
              localStorage.removeItem('athlete');
              localStorage.removeItem('athleteProfile');
              localStorage.removeItem('fullHydrationModel');
              localStorage.removeItem('weeklyActivities');
              localStorage.removeItem('weeklyTotals');

              localStorage.setItem('firebaseId', firebaseUser.uid);
              LocalStorageAPI.setAthleteId(createRes.data.athleteId);
              setSessionGate(firebaseUser.uid, createRes.data.athleteId);
              localStorage.setItem('email', createRes.data.data?.email || firebaseUser.email || '');

              router.replace('/athlete-create-profile');
              return;
            }
            throw new Error('Create route did not return valid athlete data');
          } catch (createErr: any) {
            console.error('❌ Welcome: Create route also failed:', createErr?.response?.status || createErr?.message);
            router.replace('/signup');
            return;
          }
        } else if (error?.response?.status === 401) {
          setError('Authentication error. Please sign out and sign in again.');
          setIsLoading(false);
        } else {
          setError(error?.response?.data?.error || error?.message || 'Failed to load athlete data');
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Welcome back</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Account</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.replace('/signup')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  return null;
}
