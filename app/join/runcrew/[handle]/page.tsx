'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { secondsToPace } from '@/utils/formatPace';

const RUNCREW_JOIN_INTENT_KEY = 'runCrewJoinIntent';
const RUNCREW_JOIN_INTENT_HANDLE_KEY = 'runCrewJoinIntentHandle';

/**
 * RunCrew Front Door Page
 * 
 * Route: /join/runcrew/[handle]
 * 
 * Purpose: Public-facing entry point for RunCrews
 * - Resolves RunCrew by handle (public identifier)
 * - Fetches public metadata only
 * - Renders card-style UI
 * - Handles join flow with explicit confirmation
 * 
 * Render States:
 * - Unauthenticated → Card + "Sign up to join"
 * - Authenticated, not member → Card + "Join crew"
 * - Authenticated, member → Redirect to container
 * - Has join intent → Show confirmation UI
 */
export default function RunCrewFrontDoorPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }

    if (hasFetchedRef.current) {
      return;
    }

    // Check for existing join intent (user returned from signup)
    const existingIntent = localStorage.getItem(RUNCREW_JOIN_INTENT_KEY);
    const existingHandle = localStorage.getItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    if (existingIntent && existingHandle === handle) {
      setShowJoinConfirmation(true);
    }

    // Wait for Firebase auth to be ready
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasFetchedRef.current) {
        return;
      }

      hasFetchedRef.current = true;
      setIsAuthenticated(!!firebaseUser);

      if (firebaseUser) {
        const athleteIdValue = LocalStorageAPI.getAthleteId();
        setAthleteId(athleteIdValue);
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch public metadata by handle
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

        // If authenticated, check membership
        if (firebaseUser && athleteId) {
          try {
            // Check if user is a member by calling container API
            // This will return 403 if not a member, which is expected
            const memberCheck = await api.get(`/runcrew/${data.runCrew.id}`);
            if (memberCheck.data?.success) {
              // User is a member - redirect to container
              setIsMember(true);
              router.replace(`/runcrew/${data.runCrew.id}`);
              return;
            }
          } catch (err: any) {
            // 403 means not a member - that's fine, show join button
            if (err.response?.status !== 403) {
              console.error('Error checking membership:', err);
            }
            setIsMember(false);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error('❌ FRONT DOOR: Error fetching crew:', err);
        if (err.message === 'not_found') {
          setError('not_found');
        } else {
          setError('error');
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [handle, router, athleteId]);

  const handleJoinClick = () => {
    if (!crew) return;

    if (!isAuthenticated) {
      // Route to explainer page (NOT direct signup)
      router.push(`/join/runcrew/${handle}/signup`);
    } else {
      // Store join intent and show confirmation UI
      localStorage.setItem(RUNCREW_JOIN_INTENT_KEY, crew.id);
      localStorage.setItem(RUNCREW_JOIN_INTENT_HANDLE_KEY, handle);
      setShowJoinConfirmation(true);
    }
  };

  const handleConfirmJoin = async () => {
    if (!crew || joining) return;

    setJoining(true);
    try {
      // Explicit membership mutation (ONLY place membership is created)
      const response = await api.post('/runcrew/join', { crewId: crew.id });
      
      if (response.data?.success && response.data?.runCrew) {
        // Clear join intent
        localStorage.removeItem(RUNCREW_JOIN_INTENT_KEY);
        localStorage.removeItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
        // Redirect to container (user is now a member)
        router.replace(`/runcrew/${response.data.runCrew.id}`);
      } else {
        throw new Error('Join failed');
      }
    } catch (err: any) {
      console.error('❌ FRONT DOOR: Error joining crew:', err);
      alert('Failed to join crew. Please try again.');
      setJoining(false);
    }
  };

  const handleCancelJoin = () => {
    localStorage.removeItem(RUNCREW_JOIN_INTENT_KEY);
    localStorage.removeItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    setShowJoinConfirmation(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RunCrew...</p>
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

  // Join confirmation UI (Authoritative UX Flow - Step 4)
  if (showJoinConfirmation && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                You're back 🙂
              </h2>
              <p className="text-gray-600 mb-6 text-lg">
                Do you still want to join <strong>{crew.name}</strong>?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmJoin}
                  disabled={joining}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {joining ? 'Joining...' : "Let's go"}
                </button>
                <button
                  onClick={handleCancelJoin}
                  disabled={joining}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition disabled:opacity-50"
                >
                  Not now / Explore
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format pace from seconds to MM:SS
  const easyPace = crew.easyMilesPace ? secondsToPace(crew.easyMilesPace) : null;
  const crushingPace = crew.crushingItPace ? secondsToPace(crew.crushingItPace) : null;
  
  // Format purpose array
  const purposeDisplay = Array.isArray(crew.purpose) && crew.purpose.length > 0
    ? crew.purpose.join(', ')
    : null;

  // Card UI (public view)
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Crew Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <div className="text-center">
            {/* Crew Logo/Icon */}
            <div className="flex justify-center mb-4">
              {crew.logo ? (
                <img
                  src={crew.logo}
                  alt={crew.name || 'RunCrew'}
                  className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200"
                />
              ) : crew.icon ? (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-4xl border-2 border-gray-200">
                  {crew.icon}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-4xl border-2 border-gray-200">
                  🏃
                </div>
              )}
            </div>
            
            {/* Crew Name */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {crew.name}
            </h1>
            
            {/* Compact Info */}
            <div className="space-y-2 mb-4 text-sm text-gray-600">
              {/* City */}
              {crew.city && (
                <div className="flex items-center justify-center gap-1">
                  <span>📍</span>
                  <span>{crew.city}{crew.state ? `, ${crew.state}` : ''}</span>
                </div>
              )}
              
              {/* Purpose */}
              {purposeDisplay && (
                <div className="flex items-center justify-center gap-1">
                  <span>🎯</span>
                  <span>{purposeDisplay}</span>
                </div>
              )}
              
              {/* Paces */}
              {(easyPace || crushingPace) && (
                <div className="flex items-center justify-center gap-2 text-xs">
                  {easyPace && (
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      Easy: {easyPace}/mi
                    </span>
                  )}
                  {crushingPace && (
                    <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded">
                      Tempo: {crushingPace}/mi
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Expand Details Button */}
            {(crew.description || crew.leader) && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-orange-600 hover:text-orange-700 mb-4 underline"
              >
                {showDetails ? 'Hide details' : 'Click for more details'}
              </button>
            )}
            
            {/* Expanded Details */}
            {showDetails && (
              <div className="mb-4 text-left space-y-3 text-sm text-gray-600 border-t pt-4">
                {/* Description */}
                {crew.description && (
                  <div>
                    <p className="font-medium text-gray-900 mb-1">About</p>
                    <p>{crew.description}</p>
                  </div>
                )}
                
                {/* Leader Profile Card */}
                {crew.leader && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      {/* Leader Photo */}
                      {crew.leader.photoURL ? (
                        <img
                          src={crew.leader.photoURL}
                          alt={crew.leader.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-300"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-semibold border-2 border-gray-300">
                          {crew.leader.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      {/* Leader Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 mb-1">Led by {crew.leader.name}</p>
                        {crew.leader.bio && (
                          <p className="text-sm text-gray-600 leading-relaxed">{crew.leader.bio}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Join Button */}
            <button
              onClick={handleJoinClick}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl"
            >
              {isAuthenticated ? 'Join Crew' : 'Join this Crew'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

