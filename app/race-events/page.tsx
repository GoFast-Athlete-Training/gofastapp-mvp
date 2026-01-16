'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, ExternalLink, Trophy } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';

interface Event {
  id: string;
  name: string;
  startDate: string;
  location: string;
  url: string;
  raceType?: string;
  miles?: number;
}

/**
 * Race Events Page
 * 
 * Displays upcoming races and events that athletes can sign up for.
 * Integrates with RunSignUp and other race registration platforms.
 */
export default function RaceEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch from our API first (if we have RunSignUp integration)
        try {
          const response = await api.get('/race-events');
          if (response.data?.success && response.data?.events) {
            setEvents(response.data.events);
            setLoading(false);
            return;
          }
        } catch (apiError) {
          console.log('Race events API not available, using fallback');
        }

        // Fallback: Show races that crews are training for
        try {
          const racesResponse = await api.get('/runcrew/races');
          if (racesResponse.data?.success && racesResponse.data?.races) {
            const formattedRaces = racesResponse.data.races.map((race: any) => ({
              id: race.id,
              name: race.name,
              startDate: race.date,
              location: race.city && race.state ? `${race.city}, ${race.state}` : race.city || race.state || 'Location TBD',
              url: `https://runsignup.com/Race/${race.id}`,
              raceType: race.raceType,
              miles: race.miles,
            }));
            setEvents(formattedRaces);
          }
        } catch (racesError) {
          console.error('Error loading races:', racesError);
        }
      } catch (err: any) {
        console.error('Error loading events:', err);
        setError('Could not load events at this time.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav showBack backUrl="/athlete-home" backLabel="Home" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-orange-500" />
            <h1 className="text-4xl font-bold text-gray-900">Race Events</h1>
          </div>
          <p className="text-lg text-gray-600">
            Discover upcoming races and events to register for
          </p>
        </div>

        {loading && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            Loading events...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming events found</h3>
            <p className="text-gray-600 mb-6">
              Check back soon for new race registrations, or explore RunCrews training for specific races.
            </p>
            <button
              onClick={() => router.push('/runcrew-discovery')}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Discover RunCrews →
            </button>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => {
                  if (event.url) {
                    window.open(event.url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-orange-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {event.name}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-600 mb-2">
                      {event.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(event.startDate)}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.raceType && (
                        <span className="text-orange-600 font-medium">{event.raceType}</span>
                      )}
                      {event.miles && (
                        <span className="text-gray-500">{event.miles} miles</span>
                      )}
                    </div>
                    {event.url && (
                      <p className="text-xs text-gray-500 mt-2">
                        Click to register on RunSignUp
                      </p>
                    )}
                  </div>
                  {event.url && (
                    <div className="ml-4 flex-shrink-0">
                      <ExternalLink className="h-5 w-5 text-orange-600" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            About Race Registration
          </h3>
          <p className="text-gray-700 text-sm mb-4">
            Click on any race above to open the registration page on RunSignUp. 
            You'll be able to complete your registration directly on their platform.
          </p>
          <p className="text-gray-700 text-sm">
            Looking for a training group? Check out RunCrews that are training for specific races 
            on the{' '}
            <button
              onClick={() => router.push('/runcrew-discovery')}
              className="text-orange-600 hover:text-orange-700 font-semibold underline"
            >
              RunCrew Discovery
            </button>
            {' '}page.
          </p>
        </div>
      </div>
    </div>
  );
}
