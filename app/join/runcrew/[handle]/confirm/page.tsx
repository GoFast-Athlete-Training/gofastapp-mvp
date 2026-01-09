'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

const RUNCREW_JOIN_INTENT_KEY = 'runCrewJoinIntent';
const RUNCREW_JOIN_INTENT_HANDLE_KEY = 'runCrewJoinIntentHandle';

/**
 * Join Confirmation Page
 * 
 * Route: /join/runcrew/[handle]/confirm
 * 
 * Purpose: Confirm join intent after signup
 * - User just signed up
 * - Show success message
 * - Ask for explicit confirmation to join
 * - Only place membership is created
 */
export default function JoinConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;

  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }

    // Check for join intent
    const joinIntent = localStorage.getItem(RUNCREW_JOIN_INTENT_KEY);
    const joinIntentHandle = localStorage.getItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    
    if (!joinIntent || joinIntentHandle !== handle) {
      // No intent or wrong handle - redirect to front door
      router.replace(`/join/runcrew/${handle}`);
      return;
    }

    // Fetch crew data
    async function fetchCrew() {
      try {
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
      } catch (err: any) {
        console.error('❌ CONFIRM: Error fetching crew:', err);
        if (err.message === 'not_found') {
          setError('not_found');
        } else {
          setError('error');
        }
      }
    }

    fetchCrew();

    // Check auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setIsAuthenticated(!!firebaseUser);
      
      if (firebaseUser && crew) {
        const athleteId = LocalStorageAPI.getAthleteId();
        if (athleteId) {
          // Check if already a member
          api.get(`/runcrew/${crew.id}`)
            .then(() => {
              // Already a member - redirect to member page
              router.replace(`/runcrew/${crew.id}/member`);
            })
            .catch(() => {
              // Not a member - show confirmation
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      } else if (!firebaseUser) {
        // Not authenticated - redirect to front door
        router.replace(`/join/runcrew/${handle}`);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [handle, router, crew]);

  const handleConfirmJoin = async () => {
    if (!crew || joining) return;

    setJoining(true);
    setError(null);

    try {
      // Explicit membership mutation (ONLY place membership is created)
      const response = await api.post('/runcrew/join', { crewId: crew.id });
      
      if (response.data?.success && response.data?.runCrew) {
        // Clear join intent
        localStorage.removeItem(RUNCREW_JOIN_INTENT_KEY);
        localStorage.removeItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
        
        // Redirect to success page (user is now a member)
        router.replace(`/runcrew/${response.data.runCrew.id}/join-success`);
      } else {
        throw new Error('Join failed');
      }
    } catch (err: any) {
      console.error('❌ CONFIRM: Error joining crew:', err);
      setError('Failed to join crew. Please try again.');
      setJoining(false);
    }
  };

  const handleNotNow = () => {
    // Clear join intent and go to front door
    localStorage.removeItem(RUNCREW_JOIN_INTENT_KEY);
    localStorage.removeItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    router.push(`/join/runcrew/${handle}`);
  };

  // Loading state
  if (loading || !crew) {
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
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleNotNow}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              You're all set!
            </h1>
            <p className="text-gray-600">
              Just to confirm your intent, please click below to join <strong>{crew.name}</strong>.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleConfirmJoin}
              disabled={joining || !isAuthenticated}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {joining ? 'Joining...' : "Let's go"}
            </button>
            
            <button
              onClick={handleNotNow}
              disabled={joining}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition disabled:opacity-50"
            >
              Not now / Explore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

