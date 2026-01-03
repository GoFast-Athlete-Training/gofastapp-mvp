'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import MessageFeed from '@/components/RunCrew/MessageFeed';

/**
 * Member Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/member
 * 
 * Pattern:
 * - runCrewId from URL PARAMS (not localStorage)
 * - athleteId from localStorage (authorization only)
 * - Fetch crew data via API
 */
export default function RunCrewMemberPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;

  const [crew, setCrew] = useState<any>(null);
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
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.push('/signup');
        return;
      }

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
        // If we got here, user is a member - just render the page
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching crew:', err);
        if (err.response?.status === 404) {
          setError('not_found');
        } else if (err.response?.status === 403) {
          setError('forbidden');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading crew...</p>
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

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have access to this RunCrew.</p>
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
              <h1 className="text-3xl font-bold text-gray-900">{crew.name}</h1>
              {crew.description && (
                <p className="text-gray-600 mt-2">{crew.description}</p>
              )}
            </div>
            <Link
              href="/athlete-home"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to RunCrews
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content: Messages and Announcements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Messages Section */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Crew Messages</h2>
              <MessageFeed 
                crewId={runCrewId}
                topics={crew.meta?.messageTopics || ['general', 'runs', 'social']}
                selectedTopic="general"
              />
            </section>

            {/* Announcements */}
            <section className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h3>
              {crew.announcementsBox?.announcements && crew.announcementsBox.announcements.length > 0 ? (
                <div className="space-y-4">
                  {crew.announcementsBox.announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">{announcement.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(announcement.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">{announcement.content}</div>
                      {announcement.author && (
                        <div className="text-xs text-gray-500 mt-2">
                          by {announcement.author.firstName} {announcement.author.lastName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No announcements yet.</p>
              )}
            </section>
          </div>

          {/* Sidebar: Members */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>
            {crew.membershipsBox?.memberships && crew.membershipsBox.memberships.length > 0 ? (
              <div className="space-y-3">
                {crew.membershipsBox.memberships.slice(0, 10).map((membership: any) => {
                  const athlete = membership.athlete || {};
                  return (
                    <div key={membership.id} className="flex items-center gap-3">
                      {athlete.photoURL ? (
                        <img
                          src={athlete.photoURL}
                          alt={`${athlete.firstName} ${athlete.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
                          {(athlete.firstName?.[0] || 'A').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {athlete.firstName || 'Athlete'} {athlete.lastName || ''}
                        </div>
                        {membership.role === 'admin' && (
                          <div className="text-xs text-orange-600 font-semibold">Admin</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {crew.membershipsBox.memberships.length > 10 && (
                  <p className="text-xs text-gray-500 mt-2">
                    +{crew.membershipsBox.memberships.length - 10} more members
                  </p>
                )}
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
