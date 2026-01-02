'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

/**
 * Admin Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/admin
 * 
 * Pattern:
 * - runCrewId from URL PARAMS (not localStorage)
 * - athleteId from localStorage (authorization only)
 * - Fetch crew data via API
 * - Check role via API response
 */
export default function RunCrewAdminPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;

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

    // Get athleteId from localStorage (authorization)
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.push('/signup');
      return;
    }

    const fetchCrewData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch crew data via API (API uses Firebase token from interceptor)
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (!response.data.success || !response.data.runCrew) {
          throw new Error('RunCrew not found');
        }

        const crewData = response.data.runCrew;
        setCrew(crewData);

        // API already verified membership (returns 403 if not member)
        // Find membership to check role
        const currentMembership = crewData.memberships?.find(
          (m: any) => m.athleteId === athleteId
        );

        setMembership(currentMembership);

        // Check if user is admin
        if (!currentMembership || currentMembership.role !== 'admin') {
          // Not admin - show error state
          setError('not_authorized');
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching crew:', err);
        if (err.response?.status === 404) {
          setError('not_found');
        } else if (err.response?.status === 403) {
          setError('not_authorized');
        } else {
          setError('error');
        }
        setLoading(false);
      }
    };

    fetchCrewData();
  }, [runCrewId, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
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
            href="/athlete-home"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'not_authorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Authorized</h2>
          <p className="text-gray-600 mb-4">
            You must be an admin to access this page.
          </p>
          <div className="flex gap-4">
            <Link
              href={`/runcrew/${runCrewId}/member`}
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Go to Member View
            </Link>
            <Link
              href="/athlete-home"
              className="inline-block bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              Back to Home
            </Link>
          </div>
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
            href="/athlete-home"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{crew.name} - Admin</h1>
              {crew.description && (
                <p className="text-gray-600 mt-2">{crew.description}</p>
              )}
            </div>
            <div className="flex gap-4">
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="text-gray-600 hover:text-gray-900"
              >
                Member View
              </Link>
              <Link
                href="/athlete-home"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to RunCrews
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Dashboard</h2>
          <p className="text-gray-600">
            This is the admin view for {crew.name}. Admin features coming soon.
          </p>
        </div>

        {/* Admin UI - placeholder for Phase 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Announcements */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h3>
            {crew.announcements && crew.announcements.length > 0 ? (
              <div className="space-y-4">
                {crew.announcements.map((announcement: any) => (
                  <div key={announcement.id} className="border-b pb-4 last:border-0">
                    <div className="font-medium text-gray-900">{announcement.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{announcement.content}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No announcements yet.</p>
            )}
          </div>

          {/* Members */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>
            {crew.memberships && crew.memberships.length > 0 ? (
              <div className="space-y-2">
                {crew.memberships.slice(0, 10).map((membership: any) => (
                  <div key={membership.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div>
                      <div className="text-sm font-medium">
                        {membership.athlete?.firstName} {membership.athlete?.lastName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No members yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
