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
 * RunCrew Home Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId
 * 
 * Purpose: Main landing page for a RunCrew
 * - Used for onboarding flow after joining
 * - General home page (not welcome page which is for hydration)
 * - Shows crew overview and navigation options
 */
export default function RunCrewHomePage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runCrewId) {
      setError('Missing runCrewId');
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
        console.warn('⚠️ RUNCREW HOME: No Firebase user - redirecting to signup');
        router.push('/signup');
        return;
      }

      // Mark as fetched immediately to prevent re-runs
      hasFetchedRef.current = true;

      // Get athleteId from localStorage (for reference, but API uses Firebase token)
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        console.warn('⚠️ RUNCREW HOME: No athleteId in localStorage - redirecting to signup');
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`🔍 RUNCREW HOME: Fetching crew ${runCrewId}...`);

        // Fetch crew data via API (API uses Firebase token from interceptor)
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (!response.data.success || !response.data.runCrew) {
          throw new Error('RunCrew not found');
        }

        const crewData = response.data.runCrew;
        setCrew(crewData);

        // Find current user's membership to check if they're admin
        const currentMembership = crewData.membershipsBox?.memberships?.find(
          (m: any) => m.athleteId === athleteId
        );
        setMembership(currentMembership);

        console.log(`✅ RUNCREW HOME: Crew loaded successfully: ${crewData.meta?.name}`);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ RUNCREW HOME: Error fetching crew:', err);
        if (err.response?.status === 401) {
          // 401 is handled by API interceptor (redirects to signup)
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
  }, [runCrewId, router]);

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
  if (error === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to view this RunCrew.</p>
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

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">RunCrew Not Found</h2>
          <p className="text-gray-600 mb-4">The RunCrew you're looking for doesn't exist.</p>
          <Link
            href="/welcome"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
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
          <p className="text-gray-600 mb-4">You don't have access to this RunCrew.</p>
          <Link
            href="/welcome"
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
            href="/welcome"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  // Check if user is admin or manager
  const isAdmin = membership?.role === 'admin';
  const isManager = membership?.role === 'manager';
  const memberships = crew.membershipsBox?.memberships || [];
  const announcements = crew.announcementsBox?.announcements || [];
  const runs = crew.runsBox?.runs || [];
  const upcomingRuns = runs.filter((run: any) => {
    const runDate = run.date || run.scheduledAt;
    if (!runDate) return false;
    return new Date(runDate) >= new Date();
  }).slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {crew.meta?.logo ? (
                <img
                  src={crew.meta.logo}
                  alt={crew.meta?.name || 'RunCrew'}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200"
                />
              ) : crew.meta?.icon ? (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
                  {crew.meta.icon}
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200">
                  🏃
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{crew.meta?.name}</h1>
                {crew.meta?.description && (
                  <p className="text-gray-600 mt-2">{crew.meta.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <Link
                href="/welcome"
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                ← Back to RunCrews
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to {crew.meta?.name}!
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {crew.meta?.description || 'Get ready to run with your crew and achieve your goals together.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
            <Link
              href={`/runcrew/${runCrewId}/member`}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl text-center"
            >
              View as Member
            </Link>
            {(isAdmin || isManager) && (
              <Link
                href={`/runcrew/${runCrewId}/admin`}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl text-center"
              >
                View as Admin
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">{memberships.length}</div>
            <div className="text-sm text-gray-600">Members</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">{announcements.length}</div>
            <div className="text-sm text-gray-600">Announcements</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">{upcomingRuns.length}</div>
            <div className="text-sm text-gray-600">Upcoming Runs</div>
          </div>
        </div>

        {/* Quick Preview Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Announcements */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Announcements</h3>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.slice(0, 3).map((announcement: any) => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {announcement.title && (
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                    )}
                    <p className="text-xs text-gray-600 line-clamp-2">{announcement.content || announcement.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No announcements yet.</p>
            )}
            <Link
              href={`/runcrew/${runCrewId}/member`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm font-semibold"
            >
              View all →
            </Link>
          </div>

          {/* Upcoming Runs */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Runs</h3>
            {upcomingRuns.length > 0 ? (
              <div className="space-y-3">
                {upcomingRuns.map((run: any) => {
                  const runDate = run.date || run.scheduledAt;
                  const formattedDate = runDate
                    ? new Date(runDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                    : 'Date TBD';
                  return (
                    <div key={run.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{run.title || 'Untitled Run'}</h4>
                      <p className="text-xs text-gray-600">{formattedDate}</p>
                      {run.meetUpPoint && (
                        <p className="text-xs text-gray-500 mt-1">📍 {run.meetUpPoint}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No upcoming runs scheduled.</p>
            )}
            <Link
              href={`/runcrew/${runCrewId}/member`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm font-semibold"
            >
              View all →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

