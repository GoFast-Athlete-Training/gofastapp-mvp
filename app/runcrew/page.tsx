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
  const [filterRaceTrainingGroups, setFilterRaceTrainingGroups] = useState<boolean>(false);
  const [filterTrainingForRace, setFilterTrainingForRace] = useState<string | null>(null); // race ID or null
  const [raceSearchQuery, setRaceSearchQuery] = useState('');
  const [raceSearchResults, setRaceSearchResults] = useState<any[]>([]);
  const [raceSearching, setRaceSearching] = useState(false);
  const [selectedFilterRace, setSelectedFilterRace] = useState<any | null>(null);
  const [raceDebounceTimer, setRaceDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [availableLocations, setAvailableLocations] = useState<{ 
    states: string[]; 
    citiesByState: { [state: string]: string[] } 
  }>({ 
    states: [], 
    citiesByState: {} 
  });
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [activeFilterBox, setActiveFilterBox] = useState<string | null>(null); // 'search' | 'location' | 'purpose' | 'raceTraining'

  useEffect(() => {
    fetchAvailableLocations();
    // Initial load - show all crews (no active filter)
    fetchRunCrews();
  }, []);

  const fetchAvailableLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await api.get('/runcrew/locations');
      if (response.data.success) {
        setAvailableLocations({
          states: response.data.states || [],
          citiesByState: response.data.citiesByState || {},
        });
      }
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Debounced general search - only when search box is active AND user has clicked Find
  useEffect(() => {
    if (activeFilterBox !== 'search' || !searchQuery.trim()) return;
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      fetchRunCrews();
    }, 500); // 500ms debounce for search

    setSearchDebounceTimer(timer);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, activeFilterBox]);

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
    fetchRunCrews();
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
      
      // Only apply the active filter box - they're independent discovery methods
      if (activeFilterBox === 'search' && searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      } else if (activeFilterBox === 'location') {
        if (filterCity) params.append('city', filterCity);
        if (filterState) params.append('state', filterState);
      } else if (activeFilterBox === 'purpose' && filterPurpose.length > 0) {
        filterPurpose.forEach(p => params.append('purpose', p));
      } else if (activeFilterBox === 'raceTraining') {
        if (filterRaceTrainingGroups) {
          params.append('raceTrainingGroups', 'true');
        } else if (filterTrainingForRace) {
          params.append('trainingForRace', filterTrainingForRace);
        }
      }
      
      // If no active filter, show all (or limit to recent)
      const response = await api.get(`/runcrew/discover?${params.toString()}`);
      
      if (response.data.success) {
        setRunCrews(response.data.runCrews || []);
      }
    } catch (error: any) {
      console.error('Error fetching runcrews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setActiveFilterBox(null);
    setFilterCity('');
    setFilterState('');
    setFilterPurpose([]);
    setFilterRaceTrainingGroups(false);
    setFilterTrainingForRace(null);
    setSelectedFilterRace(null);
    setRaceSearchQuery('');
    setSearchQuery('');
    fetchRunCrews();
  };

  const handleActivateFilterBox = (boxType: string) => {
    // Reset all filters when switching boxes
    if (activeFilterBox && activeFilterBox !== boxType) {
      setFilterCity('');
      setFilterState('');
      setFilterPurpose([]);
      setFilterRaceTrainingGroups(false);
      setFilterTrainingForRace(null);
      setSelectedFilterRace(null);
      setRaceSearchQuery('');
      setSearchQuery('');
    }
    setActiveFilterBox(boxType);
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

          {/* Independent Filter Boxes - Choose Your Discovery Method */}
          <div className="space-y-3 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choose your discovery method</h2>
            
            {/* Filter Box 1: Search by Name */}
            <div 
              className={`bg-white rounded-xl shadow-md p-4 border-2 transition ${
                activeFilterBox === 'search' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                1. Search by Name
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='e.g., "gofast bandits"'
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm"
                  />
                </div>
                <button
                  onClick={() => handleActivateFilterBox('search')}
                  disabled={!searchQuery.trim()}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Find
                </button>
              </div>
              {activeFilterBox === 'search' && searchQuery && (
                <p className="text-xs text-orange-600 mt-2">✓ Searching for: "{searchQuery}"</p>
              )}
            </div>

            {/* Filter Box 2: Location */}
            <div 
              className={`bg-white rounded-xl shadow-md p-4 border-2 transition ${
                activeFilterBox === 'location' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                2. Browse by Location
              </label>
              <div className="space-y-2">
                {/* Step 1: Select State */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">State</label>
                  <select
                    value={filterState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setFilterState(newState);
                      setFilterCity(''); // Clear city when state changes
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm bg-white"
                  >
                    <option value="">Select a state</option>
                    {availableLocations.states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Step 2: Select City (only shown if state is selected) */}
                {filterState && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">City (optional)</label>
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm bg-white"
                    >
                      <option value="">All cities in {filterState}</option>
                      {(availableLocations.citiesByState[filterState] || []).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => handleActivateFilterBox('location')}
                  disabled={!filterState}
                  className="w-full mt-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Find
                </button>
              </div>
              {activeFilterBox === 'location' && filterState && (
                <p className="text-xs text-orange-600 mt-2">
                  ✓ Showing crews in {filterCity ? `${filterCity}, ` : ''}{filterState}
                </p>
              )}
            </div>

            {/* Filter Box 3: Purpose */}
            <div 
              className={`bg-white rounded-xl shadow-md p-4 border-2 transition ${
                activeFilterBox === 'purpose' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                3. Browse by Purpose
              </label>
              <div className="flex gap-2 flex-wrap mb-2">
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
                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition ${
                      filterPurpose.includes(purpose)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-orange-500'
                    }`}
                  >
                    {purpose}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleActivateFilterBox('purpose')}
                disabled={filterPurpose.length === 0}
                className="w-full px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Find
              </button>
              {/* Show specific race picker when Training is selected */}
              {filterPurpose.includes('Training') && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Training for a specific race:
                  </label>
                  <div className="relative">
                    {selectedFilterRace ? (
                      <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-2 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-xs truncate">{selectedFilterRace.name}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {formatRaceDate(selectedFilterRace.date)}
                            {selectedFilterRace.miles && ` • ${selectedFilterRace.miles} mi`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFilterRace(null);
                            setFilterTrainingForRace(null);
                            setRaceSearchQuery('');
                            fetchRunCrews();
                          }}
                          className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={raceSearchQuery}
                          onChange={(e) => setRaceSearchQuery(e.target.value)}
                          placeholder="Search for a race..."
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-gray-300 focus:border-orange-500 focus:outline-none text-sm"
                        />
                        {raceSearching && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500"></div>
                          </div>
                        )}
                        {raceSearchQuery.trim() && raceSearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 border-2 border-gray-200 rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg">
                            {raceSearchResults.map((race) => (
                              <button
                                key={race.id}
                                type="button"
                                onClick={() => handleSelectFilterRace(race)}
                                className="w-full text-left p-2 hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-semibold text-gray-900 text-xs">{race.name}</div>
                                <div className="text-xs text-gray-600">
                                  {formatRaceDate(race.date)}
                                  {race.miles && ` • ${race.miles} mi`}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filter Box 4: Race Training Groups */}
            <div 
              className={`bg-white rounded-xl shadow-md p-4 border-2 transition ${
                activeFilterBox === 'raceTraining' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                4. Race Training Groups
              </label>
              <button
                onClick={() => {
                  setFilterRaceTrainingGroups(true);
                  handleActivateFilterBox('raceTraining');
                }}
                className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
              >
                Show all crews training for a race
              </button>
              {activeFilterBox === 'raceTraining' && (
                <p className="text-xs text-orange-600 mt-2">✓ Showing only race training groups</p>
              )}
            </div>

            {/* Clear Button */}
            {activeFilterBox && (
              <button
                onClick={handleClearFilters}
                className="w-full px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition"
              >
                Clear & Show All
              </button>
            )}
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
