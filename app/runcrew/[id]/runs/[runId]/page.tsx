'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.id as string;
  const runId = params.runId as string;
  
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);

  useEffect(() => {
    loadRun();
  }, [crewId, runId]);

  const loadRun = async () => {
    try {
      const response = await api.post('/runcrew/hydrate', { runCrewId: crewId });
      
      if (response.data.success) {
        const crew = response.data.runCrew;
        const foundRun = crew.runs?.find((r: any) => r.id === runId);
        if (foundRun) {
          setRun(foundRun);
          // Check if user has RSVP'd
          const athlete = await import('@/lib/localstorage').then(m => m.LocalStorageAPI.getAthlete());
          if (athlete) {
            const userRsvp = foundRun.rsvps?.find((r: any) => r.athleteId === athlete.id);
            if (userRsvp) {
              setRsvpStatus(userRsvp.status);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading run:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status: 'going' | 'maybe' | 'not-going') => {
    try {
      const athlete = await import('@/lib/localstorage').then(m => m.LocalStorageAPI.getAthlete());
      if (!athlete) {
        alert('Please sign in');
        return;
      }

      // TODO: Implement RSVP endpoint
      setRsvpStatus(status);
      alert(`RSVP'd as ${status}`);
    } catch (error) {
      console.error('Error RSVPing:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600">Run not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/runcrew/${crewId}`)}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back to Crew
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{run.title}</h1>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Date & Time</div>
              <div className="font-medium">
                {new Date(run.date).toLocaleDateString()} at {run.startTime}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Meet-up Point</div>
              <div className="font-medium">{run.meetUpPoint}</div>
              {run.meetUpAddress && (
                <div className="text-sm text-gray-600">{run.meetUpAddress}</div>
              )}
            </div>

            {run.totalMiles && (
              <div>
                <div className="text-sm text-gray-500">Distance</div>
                <div className="font-medium">{run.totalMiles} miles</div>
              </div>
            )}

            {run.pace && (
              <div>
                <div className="text-sm text-gray-500">Pace</div>
                <div className="font-medium">{run.pace}</div>
              </div>
            )}

            {run.description && (
              <div>
                <div className="text-sm text-gray-500">Description</div>
                <div className="text-gray-700">{run.description}</div>
              </div>
            )}
          </div>

          {/* RSVP Section */}
          <div className="mt-6 pt-6 border-t">
            <h2 className="text-lg font-semibold mb-4">RSVP</h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleRSVP('going')}
                className={`px-4 py-2 rounded ${
                  rsvpStatus === 'going'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Going
              </button>
              <button
                onClick={() => handleRSVP('maybe')}
                className={`px-4 py-2 rounded ${
                  rsvpStatus === 'maybe'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Maybe
              </button>
              <button
                onClick={() => handleRSVP('not-going')}
                className={`px-4 py-2 rounded ${
                  rsvpStatus === 'not-going'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Not Going
              </button>
            </div>
          </div>
        </div>

        {/* RSVP List */}
        {run.rsvps && run.rsvps.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Who's Coming</h2>
            <div className="space-y-2">
              {run.rsvps
                .filter((rsvp: any) => rsvp.status === 'going')
                .map((rsvp: any) => (
                  <div key={rsvp.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div>
                      {rsvp.athlete.firstName} {rsvp.athlete.lastName}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

