'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function RunCrewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.id as string;
  
  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrew();
  }, [crewId]);

  const loadCrew = async () => {
    try {
      const response = await api.post('/runcrew/hydrate', { runCrewId: crewId });
      
      if (response.data.success) {
        const crewData = response.data.runCrew;
        LocalStorageAPI.setPrimaryCrew(crewData);
        setCrew(crewData);
      }
    } catch (error) {
      console.error('Error loading crew:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!crew) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600">Crew not found</p>
      </div>
    );
  }

  const isAdmin = crew.userRole === 'admin' || crew.userRole === 'manager';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{crew.name}</h1>
          {crew.description && (
            <p className="mt-2 text-gray-600">{crew.description}</p>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          {isAdmin && (
            <button
              onClick={() => router.push(`/runcrew/${crewId}/admin`)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Admin Dashboard
            </button>
          )}
          <button
            onClick={() => router.push(`/runcrew/${crewId}/settings`)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Settings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Runs Section */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Upcoming Runs</h2>
            {crew.runs && crew.runs.length > 0 ? (
              <div className="space-y-4">
                {crew.runs.map((run: any) => (
                  <div
                    key={run.id}
                    onClick={() => router.push(`/runcrew/${crewId}/runs/${run.id}`)}
                    className="p-4 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <div className="font-medium">{run.title}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(run.date).toLocaleDateString()} at {run.startTime}
                    </div>
                    <div className="text-sm text-gray-500">{run.meetUpPoint}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No runs scheduled</p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Members */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Members</h2>
              {crew.memberships && crew.memberships.length > 0 ? (
                <div className="space-y-2">
                  {crew.memberships.slice(0, 10).map((membership: any) => (
                    <div key={membership.id} className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                      <div>
                        <div className="text-sm font-medium">
                          {membership.athlete.firstName} {membership.athlete.lastName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No members</p>
              )}
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Announcements</h2>
              {crew.announcements && crew.announcements.length > 0 ? (
                <div className="space-y-4">
                  {crew.announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border-b pb-4 last:border-0">
                      <div className="font-medium">{announcement.title}</div>
                      <div className="text-sm text-gray-600">{announcement.content}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No announcements</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

