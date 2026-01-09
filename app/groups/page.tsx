'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Users, Clock, Target, X } from 'lucide-react';

interface DiscoverableRunCrew {
  id: string;
  handle: string;
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
  leader: {
    name: string;
    bio: string | null;
    photoURL: string | null;
  } | null;
  memberCount: number;
  createdAt: Date;
}

/**
 * Public Groups Discovery Page
 * 
 * Route: /groups
 * 
 * Purpose: Public discovery page from landing page link
 * - No authentication required to view
 * - Uses fetch() for public API calls (no auth)
 * - Simple join flow: 9 out of 10 users → redirect to signup
 * - Edge case: If authenticated → use localStorage athleteId
 * 
 * Key difference from /runcrew:
 * - This is for NEW users coming from website
 * - /runcrew is for AUTHENTICATED users already in app
 */
export default function PublicGroupsPage() {
  const router = useRouter();
  const [runCrews, setRunCrews] = useState<DiscoverableRunCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPurpose, setFilterPurpose] = useState<string[]>([]);
  const [filterRaceTrainingGroups, setFilterRaceTrainingGroups] = useState<boolean>(false);
  const [filterTrainingForRace, setFilterTrainingForRace] = useState<string | null>(null);
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
  const [activeFilterBox, setActiveFilterBox] = useState<string | null>(null);
  const [expandedCrews, setExpandedCrews] = useState<Set<string>>(new Set());

  // Simple initialization - no auth checking
  useEffect(() => {
    fetchAvailableLocations();
    fetchRunCrews();
  }, []);

  // Public API call - no auth required
  const fetchAvailableLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await fetch('/api/runcrew/locations');
      const data = await response.json();
      if (data.success) {
        setAvailableLocations({
          states: data.states || [],
          citiesByState: data.citiesByState || {},
        });
      }
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (activeFilterBox !== 'search' || !searchQuery.trim()) return;
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      fetchRunCrews();
    }, 500);

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
      // Public API call - check if this endpoint is public
      const response = await fetch('/api/race/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setRaceSearchResults(data.race_registry || []);
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

  // Public API call - no auth required
  const fetchRunCrews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
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
      
      const response = await fetch(`/api/runcrew/discover?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setRunCrews(data.runCrews || []);
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

  // Join handler - uses same UX as invite flow
  // Always redirects to explainer page which handles:
  // - Explainer → Signup (Google/Email) → Confirm → Join API → Crew
  const handleJoin = (crew: DiscoverableRunCrew) => {
    // Always redirect to explainer page (same as invite flow)
    // The explainer page has signup built in and routes to confirm
    router.push(`/join/runcrew/${crew.handle}/signup`);
  };

  const filteredCrews = runCrews;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header - no TopNav */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.jpg" alt="GoFast" className="w-8 h-8 rounded-full" />
            <span className="text-xl font-bold text-gray-900">GoFast</span>
          </Link>
        </div>
      </header>
      
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

          {/* Filter Cards - Side by Side */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Find RunCrews by:</h2>
            
            <div className="flex flex-col lg:flex-row items-stretch gap-4 mb-4">
              {/* Filter Card 1: Search by Name */}
              <div 
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  activeFilterBox === 'search' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Search by Name
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

              {/* Separator */}
              <div className="hidden lg:flex items-center justify-center px-2">
                <span className="text-gray-400 font-medium text-sm">or</span>
              </div>

              {/* Filter Card 2: Location */}
              <div 
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  activeFilterBox === 'location' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Browse by Location
                </label>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">State</label>
                  <select
                    value={filterState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setFilterState(newState);
                      setFilterCity('');
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

              {/* Separator */}
              <div className="hidden lg:flex items-center justify-center px-2">
                <span className="text-gray-400 font-medium text-sm">or</span>
              </div>

              {/* Filter Card 3: Purpose */}
              <div 
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  activeFilterBox === 'purpose' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Browse by Purpose
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

              {/* Separator */}
              <div className="hidden lg:flex items-center justify-center px-2">
                <span className="text-gray-400 font-medium text-sm">or</span>
              </div>

              {/* Filter Card 4: Race Training Groups */}
              <div 
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  activeFilterBox === 'raceTraining' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Race Training Groups
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
            </div>

            {/* Clear Button */}
            {activeFilterBox && (
              <div className="flex justify-center">
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition"
                >
                  Clear & Show All
                </button>
              </div>
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
                  {filteredCrews.map((crew) => {
                    const isExpanded = expandedCrews.has(crew.id);

                    const handleToggleDetails = () => {
                      const newExpanded = new Set(expandedCrews);
                      if (isExpanded) {
                        newExpanded.delete(crew.id);
                      } else {
                        newExpanded.add(crew.id);
                      }
                      setExpandedCrews(newExpanded);
                    };

                    return (
                      <div
                        key={crew.id}
                        className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all"
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

                          {/* Expandable Details */}
                          {(crew.description || crew.leader) && (
                            <>
                              <button
                                onClick={handleToggleDetails}
                                className="text-sm text-orange-600 hover:text-orange-700 underline w-full text-left pt-2 border-t border-gray-200"
                              >
                                {isExpanded ? 'Hide details' : 'View details'}
                              </button>
                              {isExpanded && (
                                <div className="pt-3 space-y-3 text-sm text-gray-600 border-t border-gray-200">
                                  {/* Full Description */}
                                  {crew.description && (
                                    <div>
                                      <p className="font-medium text-gray-900 mb-1">About</p>
                                      <p>{crew.description}</p>
                                    </div>
                                  )}
                                  
                                  {/* Leader Profile Card */}
                                  {crew.leader && (
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                      <div className="flex items-start gap-3">
                                        {crew.leader.photoURL ? (
                                          <img
                                            src={crew.leader.photoURL}
                                            alt={crew.leader.name}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-300"
                                          />
                                        ) : (
                                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-semibold border-2 border-gray-300">
                                            {crew.leader.name.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-gray-900 mb-1">Led by {crew.leader.name}</p>
                                          {crew.leader.bio && (
                                            <p className="text-sm text-gray-600 leading-relaxed">{crew.leader.bio}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {/* Join Button - Always redirects to invite flow */}
                          <div className="pt-3 border-t border-gray-200">
                            <button
                              onClick={() => handleJoin(crew)}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold text-center transition"
                            >
                              Join this Crew
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

