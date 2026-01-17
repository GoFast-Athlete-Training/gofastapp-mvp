'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, ExternalLink, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { buildRunSignUpAffiliateUrl } from '@/lib/runsignup/affiliate';

interface Event {
  id: string;
  name: string;
  startDate: string | null;
  endDate?: string | null;
  location: string;
  url: string;
  category?: 'race' | 'training_program' | 'other';
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        
        console.log('🔍 Race events response (full):', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          success: response.data?.success,
          eventsCount: response.data?.events?.length || 0,
          events: response.data?.events,
          error: response.data?.error,
        });

        // Always set events array (even if empty) when success is true
        if (response.data?.success !== undefined) {
          if (response.data.success) {
            // Success - set events (may be empty array)
            const eventsArray = Array.isArray(response.data.events) ? response.data.events : [];
            console.log(`✅ Setting ${eventsArray.length} events to state`);
            console.log(`🔍 Events array content:`, eventsArray);
            setEvents(eventsArray);
            
            if (eventsArray.length === 0) {
              console.warn('⚠️ API returned success but 0 events - this is expected if all races were filtered out');
            }
            
            // Clear any previous errors
            setError(null);
          } else {
            // API returned success: false
            console.warn('⚠️ API returned success: false:', response.data);
            setEvents([]);
            setError(response.data?.error || 'Failed to load events');
          }
        } else {
          // Unexpected response structure
          console.error('❌ Unexpected response structure - missing success field:', response.data);
          setEvents([]);
          setError('Unexpected response from server');
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

  // Filter events by category
  const filteredEvents = useMemo(() => {
    if (categoryFilter === 'all') return events;
    return events.filter(event => event.category === categoryFilter);
  }, [events, categoryFilter]);

  // Get unique categories for dropdown
  const categories = useMemo(() => {
    const cats = new Set(events.map(e => e.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [events]);

  const toggleExpand = (eventId: string) => {
    setExpandedId(expandedId === eventId ? null : eventId);
  };

  const handleRaceClick = (event: Event) => {
    if (!event.url || event.url.length === 0) {
      console.warn('⚠️ No URL for race:', event.name);
      return;
    }

    console.log('🔍 Before building affiliate URL:', {
      raceName: event.name,
      originalUrl: event.url,
    });

    // Build affiliate URL with tracking
    const affiliateUrl = buildRunSignUpAffiliateUrl(event.url);
    
    if (!affiliateUrl) {
      console.warn('⚠️ Could not build affiliate URL for:', event.name);
      return;
    }

    // Log click event internally (athleteId, raceName, raceUrl)
    const athleteId = LocalStorageAPI.getAthleteId();
    console.log('🔗 Race click - opening URL:', {
      athleteId: athleteId || 'unknown',
      raceName: event.name,
      originalUrl: event.url,
      affiliateUrl: affiliateUrl,
      urlDiffers: event.url !== affiliateUrl,
      timestamp: new Date().toISOString(),
    });

    // Open affiliate URL in new tab
    // No secrets are passed, no server calls, no redirects
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
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
          <p className="text-lg text-gray-600 mb-4">
            Discover upcoming races and events to register for
          </p>
          
          {/* Category Filter Dropdown */}
          {events.length > 0 && (
            <div className="flex items-center gap-4">
              <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
                Filter by Category:
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'race' ? 'Races' : cat === 'training_program' ? 'Training Programs' : 'Other'}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">
                Showing {filteredEvents.length} of {events.length} events
              </span>
            </div>
          )}
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
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="text-center p-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No events found for the selected category.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredEvents.map((event) => {
                  const isExpanded = expandedId === (event.id || event.name);
                  
                  return (
                    <div
                      key={event.id || event.name}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Accordion Header */}
                      <div
                        onClick={() => toggleExpand(event.id || event.name)}
                        className="p-6 cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-gray-900">
                                {event.name}
                              </h3>
                              {event.category && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  event.category === 'race' 
                                    ? 'bg-orange-100 text-orange-800'
                                    : event.category === 'training_program'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {event.category === 'race' ? 'Race' : event.category === 'training_program' ? 'Training' : 'Other'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-600">
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
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-0 border-t border-gray-200 bg-gray-50">
                          <div className="mt-4 space-y-4">
                            {event.endDate && event.endDate !== event.startDate && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-1">
                                  End Date
                                </h4>
                                <p className="text-sm text-gray-700">
                                  {formatDate(event.endDate)}
                                </p>
                              </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                              {event.url && event.url.length > 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRaceClick(event);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Register on RunSignUp
                                </button>
                              ) : (
                                <p className="text-sm text-gray-400 italic">
                                  Registration link not available
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        {filteredEvents.length > 0 && (
          <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              About Race Registration
            </h3>
            <p className="text-gray-700 text-sm">
              Click "Register on RunSignUp" to open the registration page. 
              You'll be able to complete your registration directly on their platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
