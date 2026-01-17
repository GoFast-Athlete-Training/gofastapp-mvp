'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, ExternalLink, Trophy } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';

interface Event {
  id: string;
  name: string;
  startDate: string;
  location: string;
  url: string;
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
    if (typeof window === 'undefined') return;

    // Wait for Firebase auth to be ready before making API calls
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // No Firebase user - redirect to signup
      if (!firebaseUser) {
        router.push('/signup');
        return;
      }

      // Firebase user exists - load events
      try {
        setLoading(true);
        setError(null);

        // Get athleteId from localStorage (like "find my runs" pattern)
        const athleteId = LocalStorageAPI.getAthleteId();
        if (!athleteId) {
          console.warn('⚠️ No athleteId in localStorage - redirecting to signup');
          router.push('/signup');
          return;
        }

        // Fetch race events from RunSignUp API (server-side handoff)
        // Send athleteId in body so server can get athlete's state
        // Global axios instance automatically adds Firebase token to headers
        // Add timestamp to prevent caching
        const response = await api.post('/race-events', {
          athleteId,
          _t: Date.now(), // Cache buster
        }, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        
        console.log('🔍 Race events response:', {
          success: response.data?.success,
          eventsCount: response.data?.events?.length || 0,
          error: response.data?.error,
        });

        if (response.data?.success && response.data?.events) {
          setEvents(response.data.events);
          if (response.data.events.length === 0) {
            console.warn('⚠️ No events returned from API');
          }
        } else {
          console.warn('⚠️ API returned unsuccessful or no events:', response.data);
          setEvents([]);
          if (response.data?.error) {
            setError(response.data.error);
          }
        }
      } catch (err: any) {
        console.error('Error loading events:', err);
        // Don't show error if it's a 401 (auth interceptor will handle redirect)
        if (err.response?.status !== 401) {
          setError('Could not load events at this time.');
        }
        setEvents([]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming races found</h3>
            <p className="text-gray-600">
              Check back soon for new race registrations from RunSignUp.
            </p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id || event.name}
                onClick={() => {
                  // Only clickable if URL exists (strict pass-through from RunSignUp)
                  // No client-side URL construction allowed
                  if (event.url && event.url.length > 0) {
                    window.open(event.url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className={`rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition ${
                  event.url && event.url.length > 0
                    ? 'cursor-pointer hover:shadow-md hover:border-orange-300' 
                    : 'cursor-default opacity-75'
                }`}
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
                    </div>
                    {event.url && event.url.length > 0 ? (
                      <p className="text-xs text-gray-500 mt-2">
                        Click to register on RunSignUp
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2 italic">
                        Registration link not available
                      </p>
                    )}
                  </div>
                  {event.url && event.url.length > 0 && (
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
        {events.length > 0 && (
          <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              About Race Registration
            </h3>
            <p className="text-gray-700 text-sm">
              Click on any race above to open the registration page on RunSignUp. 
              You'll be able to complete your registration directly on their platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
