'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { MapPin, Calendar, Clock, Map } from 'lucide-react';

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
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
}

export default function GoRunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string>('');
  const [runClubSlug, setRunClubSlug] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);

  // Read runClubSlug from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = searchParams.get('runClubSlug');
    setRunClubSlug(slug);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if user is authenticated
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.push('/signup');
      return;
    }

    fetchRuns();
  }, [cityFilter, dayFilter, runClubSlug, router]);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (cityFilter && cityFilter !== 'All Cities') {
        params.append('citySlug', cityFilter);
      }
      if (dayFilter && dayFilter !== 'All Days') {
        params.append('day', dayFilter);
      }
      if (runClubSlug) {
        params.append('runClubSlug', runClubSlug);
      }

      const response = await api.get(`/runs?${params.toString()}`);
      
      if (response.data.success) {
        const fetchedRuns = response.data.runs || [];
        setRuns(fetchedRuns);
        
        // Extract unique cities and days
        const cities: string[] = [...new Set(fetchedRuns.map((r: Run) => r.citySlug))].sort() as string[];
        setAvailableCities(cities);
        
        const days = new Set<string>();
        fetchedRuns.forEach((r: Run) => {
          if (r.isRecurring && r.dayOfWeek) {
            days.add(r.dayOfWeek);
          } else {
            const date = new Date(r.startDate);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            days.add(dayNames[date.getDay()]);
          }
        });
        const sortedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          .filter(d => days.has(d));
        setAvailableDays(sortedDays);
      }
    } catch (error: any) {
      console.error('Error fetching runs:', error);
      if (error.response?.status === 401) {
        router.push('/signup');
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
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ready to go run?
          </h1>
          <p className="text-gray-600">
            Select your city and see what's happening
          </p>
        </div>

        {/* RunClub Filter Banner */}
        {runClubSlug && (
          <div className="mb-6 bg-sky-50 border border-sky-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-900">
                  Showing runs for: <span className="font-semibold">{runClubSlug}</span>
                </p>
                <p className="text-xs text-sky-700 mt-1">
                  Viewing all runs from this run club
                </p>
              </div>
              <button
                onClick={() => {
                  setRunClubSlug(null);
                  // Remove from URL
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.delete('runClubSlug');
                  router.push(newUrl.pathname + newUrl.search);
                }}
                className="text-xs text-sky-700 hover:text-sky-900 underline"
              >
                Clear filter
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Cities</option>
              {availableCities.map(city => (
                <option key={city} value={city}>
                  {city.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Day
            </label>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Days</option>
              {availableDays.map(day => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Runs List */}
        {runs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runs.map((run) => {
              // Format city name from citySlug or use meetUpCity
              const cityName = run.meetUpCity || 
                run.citySlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              return (
                <div
                  key={run.id}
                  onClick={() => router.push(`/gorun/${run.id}`)}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border border-gray-200 hover:border-orange-300"
                >
                  {/* Run Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-4 line-clamp-2">
                    {run.title}
                  </h3>

                  {/* Mileage & Pace */}
                  <div className="flex items-center gap-4 mb-3">
                    {run.totalMiles && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">🏃</span>
                        <span className="font-semibold">{run.totalMiles}</span>
                        <span className="text-sm text-gray-600">miles</span>
                      </div>
                    )}
                    {run.pace && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">⚡</span>
                        <span className="font-semibold">{run.pace}</span>
                      </div>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{cityName}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-1.5 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {run.isRecurring ? (
                          <span>
                            Every <span className="font-semibold text-gray-900">{run.dayOfWeek}</span>
                          </span>
                        ) : (
                          formatDate(run.startDate)
                        )}
                      </span>
                    </div>
                    {(run.startTimeHour !== null && run.startTimeMinute !== null) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}</span>
                      </div>
                    )}
                  </div>

                  {/* Location (truncated) */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-700 font-medium line-clamp-1">
                      {run.meetUpPoint}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/gorun/${run.id}`);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-semibold transition text-sm"
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No runs found
            </h2>
            <p className="text-gray-600">
              {cityFilter || dayFilter
                ? 'Try adjusting your filters to see more runs'
                : 'Check back soon for upcoming runs in your area'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

