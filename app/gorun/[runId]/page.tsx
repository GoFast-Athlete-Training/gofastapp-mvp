'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { MapPin, Calendar, Clock, Map, ArrowLeft, Users } from 'lucide-react';

interface RunClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface RunCrew {
  id: string;
  name: string;
  logo: string | null;
  handle: string;
}

interface Run {
  id: string;
  title: string;
  citySlug: string;
  isRecurring: boolean;
  dayOfWeek: string | null;
  startDate: string;
  date: string;
  endDate: string | null;
  runClubSlug: string | null;
  runCrewId: string | null;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
  runClub?: RunClub | null;
  runCrew?: RunCrew | null;
  rsvps?: any[];
  currentRSVP?: string | null;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRSVP, setCurrentRSVP] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvps, setRsvps] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !runId) return;

    // Check if user is authenticated
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.push('/signup');
      return;
    }

    fetchRun();
  }, [runId, router]);

  const fetchRun = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/runs/${runId}`);
      
      if (!response.data.success || !response.data.run) {
        setError('Run not found');
        return;
      }

      const runData = response.data.run;
      setRun(runData);
      setRsvps(runData.rsvps || []);
      setCurrentRSVP(runData.currentRSVP || null);
    } catch (error: any) {
      console.error('Error fetching run:', error);
      if (error.response?.status === 401) {
        router.push('/signup');
      } else if (error.response?.status === 404) {
        setError('Run not found');
      } else {
        setError('Failed to load run');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour: number | null, minute: number | null, period: string | null) => {
    if (hour === null || minute === null) return '';
    const minStr = minute.toString().padStart(2, '0');
    return `${hour}:${minStr} ${period || 'AM'}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Run not found'}</h1>
          <button
            onClick={() => router.push('/gorun')}
            className="text-orange-500 hover:text-orange-600 font-semibold"
          >
            ← Back to Runs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/gorun')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Runs</span>
        </button>

        {/* RunClub or RunCrew Header */}
        {(run.runClub || run.runCrew) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              {run.runClub && (
                <>
                  {run.runClub.logoUrl && (
                    <img
                      src={run.runClub.logoUrl}
                      alt={run.runClub.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />
                  )}
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wide mb-1">
                      Hosted by RunClub
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {run.runClub.name}
                    </div>
                    {run.runClub.city && (
                      <div className="text-sm text-gray-600">
                        {run.runClub.city}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {run.runCrew && (
                <>
                  {run.runCrew.logo && (
                    <img
                      src={run.runCrew.logo}
                      alt={run.runCrew.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />
                  )}
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wide mb-1">
                      Hosted by RunCrew
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {run.runCrew.name}
                    </div>
                    <a
                      href={`/runcrew/${run.runCrew.handle}`}
                      className="text-sm text-orange-500 hover:text-orange-600"
                    >
                      View RunCrew →
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Run Details */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{run.title}</h1>

          {/* Date & Time */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3 text-gray-700">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                {run.isRecurring ? (
                  <div>
                    <span className="font-semibold">Every {run.dayOfWeek}</span>
                    {run.startDate && (
                      <span className="text-gray-600"> (starts {formatDate(run.startDate)})</span>
                    )}
                  </div>
                ) : (
                  <span>{formatDate(run.startDate)}</span>
                )}
              </div>
            </div>

            {(run.startTimeHour !== null && run.startTimeMinute !== null) && (
              <div className="flex items-center gap-3 text-gray-700">
                <Clock className="h-5 w-5 text-gray-400" />
                <span>{formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}</span>
              </div>
            )}

            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="font-semibold">{run.meetUpPoint}</div>
                {(run.meetUpStreetAddress || run.meetUpCity) && (
                  <div className="text-gray-600">
                    {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState, run.meetUpZip]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
                {run.meetUpLat && run.meetUpLng && (
                  <a
                    href={`https://www.google.com/maps?q=${run.meetUpLat},${run.meetUpLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-500 hover:text-orange-600 mt-1 inline-block"
                  >
                    Open in Maps →
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Run Details */}
          <div className="flex flex-wrap gap-6 mb-6 pb-6 border-b border-gray-200">
            {run.totalMiles && (
              <div>
                <div className="text-sm text-gray-500">Distance</div>
                <div className="text-lg font-semibold text-gray-900">{run.totalMiles} miles</div>
              </div>
            )}
            {run.pace && (
              <div>
                <div className="text-sm text-gray-500">Pace</div>
                <div className="text-lg font-semibold text-gray-900">{run.pace}</div>
              </div>
            )}
          </div>

          {/* Description */}
          {run.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">About This Run</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{run.description}</p>
            </div>
          )}

          {/* Strava Route */}
          {run.stravaMapUrl && (
            <div className="mb-6">
              <a
                href={run.stravaMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold"
              >
                <Map className="h-5 w-5" />
                <span>View Route on Strava</span>
              </a>
            </div>
          )}

          {/* RSVPs Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">People Going</h2>
            
            {rsvps.length === 0 ? (
              <p className="text-gray-500">No RSVPs yet. Be the first!</p>
            ) : (
              <div className="space-y-4">
                {rsvps.filter((r: any) => r.status === 'going').length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-green-600 mb-3">
                      Going ({rsvps.filter((r: any) => r.status === 'going').length})
                    </h3>
                    <div className="space-y-2">
                      {rsvps
                        .filter((r: any) => r.status === 'going')
                        .map((rsvp: any) => (
                          <div key={rsvp.id} className="flex items-center gap-3">
                            {rsvp.Athlete?.photoURL ? (
                              <img
                                src={rsvp.Athlete.photoURL}
                                alt={rsvp.Athlete?.firstName || 'Member'}
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold border-2 border-gray-200">
                                {(rsvp.Athlete?.firstName?.[0] || 'M').toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-900 font-medium">
                              {rsvp.Athlete?.firstName} {rsvp.Athlete?.lastName}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RSVP Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Your RSVP</h3>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setRsvpLoading(true);
                    try {
                      const response = await api.post(`/runs/${runId}/rsvp`, { status: 'going' });
                      if (response.data.success) {
                        setCurrentRSVP('going');
                        // Refresh run data
                        const runResponse = await api.get(`/runs/${runId}`);
                        if (runResponse.data.success) {
                          const updatedRun = runResponse.data.run;
                          setRsvps(updatedRun.rsvps || []);
                        }
                      }
                    } catch (err: any) {
                      console.error('Error RSVPing:', err);
                      alert(err.response?.data?.error || 'Failed to RSVP');
                    } finally {
                      setRsvpLoading(false);
                    }
                  }}
                  disabled={rsvpLoading}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    currentRSVP === 'going'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Going
                </button>
                <button
                  onClick={async () => {
                    setRsvpLoading(true);
                    try {
                      const response = await api.post(`/runs/${runId}/rsvp`, { status: 'not-going' });
                      if (response.data.success) {
                        setCurrentRSVP('not-going');
                        // Refresh run data
                        const runResponse = await api.get(`/runs/${runId}`);
                        if (runResponse.data.success) {
                          const updatedRun = runResponse.data.run;
                          setRsvps(updatedRun.rsvps || []);
                        }
                      }
                    } catch (err: any) {
                      console.error('Error RSVPing:', err);
                      alert(err.response?.data?.error || 'Failed to RSVP');
                    } finally {
                      setRsvpLoading(false);
                    }
                  }}
                  disabled={rsvpLoading}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
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
        </div>
      </div>
    </div>
  );
}

