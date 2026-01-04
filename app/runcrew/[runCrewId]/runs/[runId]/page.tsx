'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

/**
 * Run Detail Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/runs/:runId
 * 
 * Pattern:
 * - runCrewId and runId from URL PARAMS
 * - Wait for Firebase auth to be ready before making API calls
 * - Fetch crew data via API (includes runsBox)
 * - Find run in crew.runsBox.runs
 */
export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;
  const runId = params.runId as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRSVP, setCurrentRSVP] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (!runCrewId || !runId) {
      setError('Missing runCrewId or runId');
      setLoading(false);
      return;
    }

    // Prevent multiple fetches
    if (hasFetchedRef.current) {
      return;
    }

    // Wait for Firebase auth to be ready before making API calls
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Already fetched, ignore
      if (hasFetchedRef.current) {
        return;
      }

      // No Firebase user - redirect to signup
      if (!firebaseUser) {
        hasFetchedRef.current = true;
        console.warn('⚠️ RUN DETAIL: No Firebase user - redirecting to signup');
        router.push('/signup');
        return;
      }

      // Mark as fetched immediately to prevent re-runs
      hasFetchedRef.current = true;

      // Get athleteId from localStorage (for reference, but API uses Firebase token)
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        console.warn('⚠️ RUN DETAIL: No athleteId in localStorage - redirecting to signup');
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`🔍 RUN DETAIL: Fetching crew ${runCrewId} and run ${runId}...`);

        // Fetch crew data via API (includes runsBox)
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (!response.data.success || !response.data.runCrew) {
          throw new Error('RunCrew not found');
        }

        const crewData = response.data.runCrew;
        setCrew(crewData);

        // Find current user's membership
        const currentMembership = crewData.membershipsBox?.memberships?.find(
          (m: any) => m.athleteId === athleteId
        );
        setMembership(currentMembership);

        // Find the run in runsBox
        const foundRun = crewData.runsBox?.runs?.find((r: any) => r.id === runId);
        if (!foundRun) {
          setError('not_found');
          setLoading(false);
          return;
        }

        setRun(foundRun);

        // Find current user's RSVP
        const userRSVP = foundRun.rsvps?.find((r: any) => r.athleteId === athleteId);
        setCurrentRSVP(userRSVP?.status || null);

        console.log(`✅ RUN DETAIL: Run loaded successfully: ${foundRun.title}`);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ RUN DETAIL: Error fetching run:', err);
        if (err.response?.status === 401) {
          setError('unauthorized');
        } else if (err.response?.status === 404) {
          setError('not_found');
        } else if (err.response?.status === 403) {
          setError('forbidden');
        } else {
          setError('error');
        }
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [runCrewId, runId, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading run details...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unauthorized</h2>
          <p className="text-gray-600 mb-4">Please sign in to view this run.</p>
          <Link
            href="/signup"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'not_found' || !run) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Run Not Found</h2>
          <p className="text-gray-600 mb-4">This run doesn't exist or you don't have access to it.</p>
          <Link
            href={`/runcrew/${runCrewId}/member`}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Crew
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to view this run.</p>
          <Link
            href={`/runcrew/${runCrewId}/member`}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Crew
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
          <p className="text-gray-600 mb-4">Failed to load run details.</p>
          <Link
            href={`/runcrew/${runCrewId}/member`}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Crew
          </Link>
        </div>
      </div>
    );
  }

  // Group RSVPs by status (handle both 'not_going' and 'not-going' for compatibility)
  const rsvps = run.rsvps || [];
  const going = rsvps.filter((r: any) => r.status === 'going');
  const notGoing = rsvps.filter((r: any) => r.status === 'not-going' || r.status === 'not_going');
  const maybe = rsvps.filter((r: any) => r.status === 'maybe');

  // Handle RSVP
  const handleRSVP = async (status: 'going' | 'maybe' | 'not-going') => {
    setRsvpLoading(true);
    try {
      const response = await api.post(`/runcrew/${runCrewId}/runs/${runId}/rsvp`, { status });
      if (response.data.success) {
        setCurrentRSVP(status);
        // Refresh run data to get updated RSVPs
        const crewResponse = await api.get(`/runcrew/${runCrewId}`);
        if (crewResponse.data.success && crewResponse.data.runCrew) {
          const updatedRun = crewResponse.data.runCrew.runsBox?.runs?.find((r: any) => r.id === runId);
          if (updatedRun) {
            setRun(updatedRun);
          }
        }
      }
    } catch (err: any) {
      console.error('Error RSVPing:', err);
      alert(err.response?.data?.error || 'Failed to RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Crew
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{run.title}</h1>
                <p className="text-sm text-gray-600 mt-1">{crew.runCrewBaseInfo?.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-500">Date & Time</h2>
              <p className="text-lg text-gray-900">
                {new Date(run.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-lg text-gray-900">{run.startTime}</p>
            </div>

            {run.meetUpPoint && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">Meet Up Point</h2>
                <p className="text-lg text-gray-900">{run.meetUpPoint}</p>
              </div>
            )}

            {run.meetUpAddress && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">Address</h2>
                <p className="text-lg text-gray-900">{run.meetUpAddress}</p>
              </div>
            )}

            {run.totalMiles && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">Distance</h2>
                <p className="text-lg text-gray-900">{run.totalMiles} miles</p>
              </div>
            )}

            {run.pace && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">Pace</h2>
                <p className="text-lg text-gray-900">{run.pace}</p>
              </div>
            )}

            {run.description && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">Description</h2>
                <p className="text-lg text-gray-900 whitespace-pre-wrap">{run.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* RSVPs Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">RSVPs</h2>
          
          {rsvps.length === 0 ? (
            <p className="text-gray-500">No RSVPs yet.</p>
          ) : (
            <div className="space-y-6">
              {going.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-600 mb-2">
                    Going ({going.length})
                  </h3>
                  <div className="space-y-2">
                    {going.map((rsvp: any) => (
                      <div key={rsvp.id} className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {rsvp.athlete?.firstName} {rsvp.athlete?.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {maybe.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-yellow-600 mb-2">
                    Maybe ({maybe.length})
                  </h3>
                  <div className="space-y-2">
                    {maybe.map((rsvp: any) => (
                      <div key={rsvp.id} className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {rsvp.athlete?.firstName} {rsvp.athlete?.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notGoing.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-600 mb-2">
                    Not Going ({notGoing.length})
                  </h3>
                  <div className="space-y-2">
                    {notGoing.map((rsvp: any) => (
                      <div key={rsvp.id} className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {rsvp.athlete?.firstName} {rsvp.athlete?.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RSVP Section */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your RSVP</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleRSVP('going')}
                disabled={rsvpLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  currentRSVP === 'going'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Going
              </button>
              <button
                onClick={() => handleRSVP('maybe')}
                disabled={rsvpLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  currentRSVP === 'maybe'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Maybe
              </button>
              <button
                onClick={() => handleRSVP('not-going')}
                disabled={rsvpLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  currentRSVP === 'not-going' || currentRSVP === 'not_going'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Not Going
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

