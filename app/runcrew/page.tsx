'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import { Search, MapPin, Users, Clock, Target, X } from 'lucide-react';

interface DiscoverableRunCrew {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  icon: string | null;
  city: string | null;
  state: string | null;
  paceRange: string | null;
  gender: string | null;
  ageRange: string | null;
  primaryMeetUpPoint: string | null;
  primaryMeetUpAddress: string | null;
  purpose: string[] | null;
  timePreference: string[] | null;
  typicalRunMiles: number | null;
  trainingForRace: string | null;
  race: {
    id: string;
    name: string;
    raceType: string | null;
    miles: number | null;
    date: Date | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  memberCount: number;
  createdAt: Date;
}

export default function RunCrewDiscoveryPage() {
  const router = useRouter();
  const [runCrews, setRunCrews] = useState<DiscoverableRunCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPurpose, setFilterPurpose] = useState<string[]>([]);
  const [filterTrainingForRace, setFilterTrainingForRace] = useState<string | null>(null); // race ID or null
  const [raceSearchQuery, setRaceSearchQuery] = useState('');
  const [raceSearchResults, setRaceSearchResults] = useState<any[]>([]);
  const [raceSearching, setRaceSearching] = useState(false);
  const [selectedFilterRace, setSelectedFilterRace] = useState<any | null>(null);
  const [raceDebounceTimer, setRaceDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchRunCrews();
  }, []);

  // Debounced general search - calls API when user types
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (!searchQuery.trim()) {
      // If search is empty, fetch all (with filters if any)
      fetchRunCrews();
      return;
    }

    const timer = setTimeout(() => {
      fetchRunCrews();
    }, 500); // 500ms debounce for search

    setSearchDebounceTimer(timer);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery]);

  // Format race date helper
  function formatRaceDate(dateString: string | Date): string {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return 'Invalid date';
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      return `${month}/${day}/${year}`;
    } catch {
      return 'Invalid date';
    }
  }

  // Race search handler
  const handleRaceSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setRaceSearchResults([]);
      return;
    }

    setRaceSearching(true);
    try {
      const response = await api.post('/race/search', { query: query.trim() });
      if (response.data.success) {
        setRaceSearchResults(response.data.race_registry || []);
      } else {
        setRaceSearchResults([]);
      }
    } catch (err: any) {
      console.error('Race search error:', err);
      setRaceSearchResults([]);
    } finally {
      setRaceSearching(false);
    }
  }, []);

  // Debounce race search
  useEffect(() => {
    if (raceDebounceTimer) {
      clearTimeout(raceDebounceTimer);
    }

    if (!raceSearchQuery.trim()) {
      setRaceSearchResults([]);
      setRaceSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      handleRaceSearch(raceSearchQuery);
    }, 300);

    setRaceDebounceTimer(timer);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [raceSearchQuery, handleRaceSearch]);

  // Handle race selection for filter
  const handleSelectFilterRace = (race: any) => {
    setSelectedFilterRace(race);
    setFilterTrainingForRace(race.id);
    setRaceSearchQuery(race.name);
    setRaceSearchResults([]);
    handleApplyFilters();
  };


  // Convert pace from MM:SS to seconds
  const convertPaceToSeconds = (paceStr: string): number | undefined => {
    if (!paceStr.trim()) return undefined;
    const parts = paceStr.trim().split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes * 60 + seconds;
    }
    return undefined;
  };

  const fetchRunCrews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // General search query
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      // Location filters
      if (filterCity) params.append('city', filterCity);
      if (filterState) params.append('state', filterState);
      
      // Purpose filters
      filterPurpose.forEach(p => params.append('purpose', p));
      
      // Training for Race filter (race ID string)
      if (filterTrainingForRace) {
        params.append('trainingForRace', filterTrainingForRace); // Specific race ID
      }
      
      const response = await api.get(`/runcrew/discover?${params.toString()}`);
      
      if (response.data.success) {
        setRunCrews(response.data.runCrews || []);
      }
    } catch (error: any) {
      console.error('Error fetching runcrews:', error);
    } finally {
      setLoading(false);
      setApplyingFilters(false);
    }
  };

  const handleApplyFilters = () => {
    setApplyingFilters(true);
    fetchRunCrews();
  };

  const handleClearFilters = () => {
    setFilterCity('');
    setFilterState('');
    setFilterPurpose([]);
    setFilterTrainingForRace(null);
    setSelectedFilterRace(null);
    setRaceSearchQuery('');
    setSearchQuery('');
    fetchRunCrews();
  };

  // Use runCrews directly - filtering is done by API
  const filteredCrews = runCrews;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                Find Your Accountability
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Check out these RunCrews that are already going. Take a look around, and if you don't see one you like, feel free to start your own.
              </p>
            </div>
            <Link
              href="/runcrew/create"
              className="hidden sm:flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl whitespace-nowrap"
            >
              <span>+</span>
              <span>Start Your Crew</span>
            </Link>
          </div>

          {/* Mobile Create Button */}
          <div className="sm:hidden mb-4">
            <Link
              href="/runcrew/create"
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg w-full"
            >
              <span>+</span>
              <span>Start Your Crew</span>
            </Link>
          </div>

          {/* Search Section - Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* General Search */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='e.g., "gofast bandits"'
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Search by crew name, location, or description</p>
            </div>

            {/* Look Up By Filters */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Look Up By...
              </label>
              
              {/* City Filter */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  placeholder="e.g. Arlington"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                />
              </div>

              {/* State Filter */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  placeholder="e.g. VA"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                />
              </div>

              {/* Purpose Filter */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Purpose
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['Training', 'Social', 'General Fitness'] as const).map((purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => {
                        const newPurpose = filterPurpose.includes(purpose)
                          ? filterPurpose.filter((p) => p !== purpose)
                          : [...filterPurpose, purpose];
                        setFilterPurpose(newPurpose);
                        // Clear race filter if Training is deselected
                        if (purpose === 'Training' && filterPurpose.includes('Training')) {
                          setFilterTrainingForRace(null);
                          setSelectedFilterRace(null);
                          setRaceSearchQuery('');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border-2 font-medium text-sm transition ${
                        filterPurpose.includes(purpose)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-500'
                      }`}
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
              </div>

              {/* Training for Race - Only if Purpose includes Training */}
              {filterPurpose.includes('Training') && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Training for a race
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Search for a specific race</p>
                  
                  {selectedFilterRace ? (
                    <div className="bg-white border-2 border-orange-500 rounded-lg p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{selectedFilterRace.name}</div>
                          <div className="text-xs text-gray-600">
                            {selectedFilterRace.raceType?.toUpperCase()} ({selectedFilterRace.miles} miles) • {formatRaceDate(selectedFilterRace.date)}
                            {selectedFilterRace.city && ` • ${selectedFilterRace.city}, ${selectedFilterRace.state || selectedFilterRace.country}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFilterRace(null);
                            setFilterTrainingForRace(null);
                            setRaceSearchQuery('');
                            handleApplyFilters();
                          }}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={raceSearchQuery}
                        onChange={(e) => setRaceSearchQuery(e.target.value)}
                        placeholder="Search for a race (e.g., Boston Marathon)"
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-orange-500 focus:outline-none text-sm"
                      />
                      {raceSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                        </div>
                      )}

                      {/* Search Results Dropdown */}
                      {raceSearchQuery.trim() && raceSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 border-2 border-gray-200 rounded-lg bg-white max-h-48 overflow-y-auto shadow-lg">
                          {raceSearchResults.map((race) => (
                            <button
                              key={race.id}
                              type="button"
                              onClick={() => handleSelectFilterRace(race)}
                              className="w-full text-left p-3 hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-semibold text-gray-900 text-sm">{race.name}</div>
                              <div className="text-xs text-gray-600">
                                {race.raceType?.toUpperCase()} ({race.miles} miles) • {formatRaceDate(race.date)}
                                {race.city && ` • ${race.city}, ${race.state || race.country}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No Results */}
                      {raceSearchQuery.trim() && !raceSearching && raceSearchResults.length === 0 && raceSearchQuery.length >= 2 && (
                        <div className="mt-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-900">No races found. Try a different search term.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Apply Filters Button */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleApplyFilters}
                  disabled={applyingFilters}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applyingFilters ? 'Applying...' : 'Apply Filters'}
                </button>
                {(filterCity || filterState || filterPurpose.length > 0 || filterTrainingForRace) && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Finding RunCrews...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <>
            {filteredCrews.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">🏃</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {searchQuery || filterCity || filterState
                    ? "No RunCrews found"
                    : "No RunCrews yet"}
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery || filterCity || filterState
                    ? "Try adjusting your search or filters, or be the first to start a RunCrew in your area!"
                    : "Be the first to start a RunCrew and build your accountability crew!"}
                </p>
                <Link
                  href="/runcrew/create"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
                >
                  Start Your Crew
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {filteredCrews.length} {filteredCrews.length === 1 ? 'RunCrew' : 'RunCrews'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCrews.map((crew) => (
                    <Link
                      key={crew.id}
                      href={`/runcrew/${crew.id}`}
                      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
                    >
                      {/* Crew Header */}
                      <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                        <div className="flex items-start gap-4 mb-3">
                          {crew.logo ? (
                            <img
                              src={crew.logo}
                              alt={crew.name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
                            />
                          ) : crew.icon ? (
                            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl border-2 border-white shadow-md flex-shrink-0">
                              {crew.icon}
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-3xl text-white border-2 border-white shadow-md flex-shrink-0">
                              🏃
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">
                              {crew.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{crew.memberCount} {crew.memberCount === 1 ? 'member' : 'members'}</span>
                            </div>
                          </div>
                        </div>
                        {crew.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{crew.description}</p>
                        )}
                      </div>

                      {/* Crew Details */}
                      <div className="p-6 space-y-3">
                        {/* Location */}
                        {(crew.city || crew.state || crew.primaryMeetUpPoint) && (
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span className="line-clamp-1">
                              {crew.primaryMeetUpPoint || 
                               (crew.city && crew.state ? `${crew.city}, ${crew.state}` : 
                                crew.city || crew.state || 'Location TBD')}
                            </span>
                          </div>
                        )}

                        {/* Pace Range */}
                        {crew.paceRange && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Target className="w-4 h-4 text-gray-400" />
                            <span>{crew.paceRange}</span>
                          </div>
                        )}

                        {/* Time Preference */}
                        {crew.timePreference && crew.timePreference.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{crew.timePreference.join(', ')}</span>
                          </div>
                        )}

                        {/* Purpose Tags */}
                        {crew.purpose && crew.purpose.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {crew.purpose.map((purpose, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full"
                              >
                                {purpose}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Training for Race */}
                        {crew.purpose?.includes('Training') && crew.race && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Training for:</div>
                            <div className="text-sm font-semibold text-gray-900">{crew.race.name}</div>
                            {crew.race.date && (
                              <div className="text-xs text-gray-600">
                                {new Date(crew.race.date).toLocaleDateString()}
                                {crew.race.miles && ` • ${crew.race.miles} miles`}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Join Button */}
                        <div className="pt-3 border-t border-gray-200">
                          <div className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-center transition">
                            View Details
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Fallback CTA */}
        {!loading && filteredCrews.length > 0 && (
          <div className="mt-12 bg-white rounded-xl shadow-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Don't see one you like?
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start your own RunCrew and build your accountability crew from scratch.
            </p>
            <Link
              href="/runcrew/create"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
            >
              Start Your Crew
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
