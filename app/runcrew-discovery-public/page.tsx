'use client';


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
 * Public RunCrew Discovery Page
 * 
 * Route: /runcrew-discovery-public
 * 
 * Purpose: Public discovery page from landing page link
 * - No authentication required to view
 * - Uses fetch() for public API calls (no auth)
 * - Simple join flow: 9 out of 10 users → redirect to signup
 * - Edge case: If authenticated → use localStorage athleteId
 * 
 * Key difference from /runcrew-discovery:
 * - This is for NEW users coming from website
 * - /runcrew-discovery is for AUTHENTICATED users already in app
 */
export default function PublicGroupsPage() {
  const router = useRouter();
  const [runCrews, setRunCrews] = useState<DiscoverableRunCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPurpose, setFilterPurpose] = useState<string[]>([]);
  // Race filter state
  const [filterRaceId, setFilterRaceId] = useState<string>('');
  const [filterRaceState, setFilterRaceState] = useState<string>('');
  const [filterRaceCity, setFilterRaceCity] = useState<string>('');
  const [availableRaces, setAvailableRaces] = useState<Array<{
    id: string;
    name: string;
    raceType: string;
    miles: number;
    date: Date | string;
    city: string | null;
    state: string | null;
  }>>([]);
  const [raceLocations, setRaceLocations] = useState<{ 
    states: string[]; 
    citiesByState: { [state: string]: string[] } 
  }>({ 
    states: [], 
    citiesByState: {} 
  });
  const [loadingRaceData, setLoadingRaceData] = useState(false);
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
    fetchRaces();
    fetchRunCrews();
  }, []);

  // Fetch races (by name) that have groups
  const fetchRaces = async () => {
    try {
      setLoadingRaceData(true);
      const response = await fetch('/api/runcrew/races');
      const data = await response.json();
      if (data.success) {
        setAvailableRaces(data.races || []);
      }
    } catch (error: any) {
      console.error('Error fetching races:', error);
    } finally {
      setLoadingRaceData(false);
    }
  };

  // Fetch race locations when race is selected
  useEffect(() => {
    if (filterRaceId) {
      fetchRaceLocations();
    } else {
      setRaceLocations({ states: [], citiesByState: {} });
      setFilterRaceState('');
      setFilterRaceCity('');
    }
  }, [filterRaceId]);

  const fetchRaceLocations = async () => {
    try {
      setLoadingRaceData(true);
      const response = await fetch(`/api/runcrew/race-locations?raceId=${encodeURIComponent(filterRaceId)}`);
      const data = await response.json();
      if (data.success) {
        setRaceLocations({
          states: data.states || [],
          citiesByState: data.citiesByState || {},
        });
      }
    } catch (error: any) {
      console.error('Error fetching race locations:', error);
    } finally {
      setLoadingRaceData(false);
    }
  };

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
      } else if (activeFilterBox === 'race') {
        // For MVP1, if race filter is active, show all race training groups
        // If race is selected, filter by it
        if (filterRaceId) {
          params.append('raceId', filterRaceId);
          if (filterRaceState) params.append('raceState', filterRaceState);
          if (filterRaceCity) params.append('raceCity', filterRaceCity);
        } else {
          // Just show all race training groups (hydration approach for MVP1)
          params.append('raceTrainingGroups', 'true');
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
    setFilterRaceId('');
    setFilterRaceState('');
    setFilterRaceCity('');
    setSearchQuery('');
    fetchRunCrews();
  };

  const handleActivateFilterBox = (boxType: string) => {
    if (activeFilterBox && activeFilterBox !== boxType) {
      setFilterCity('');
      setFilterState('');
      setFilterPurpose([]);
      setFilterRaceId('');
      setFilterRaceState('');
      setFilterRaceCity('');
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
              href="/public/create-crew/signup"
              className="hidden sm:flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl whitespace-nowrap"
            >
              <span>+</span>
              <span>Start Your Crew</span>
            </Link>
          </div>

          {/* Mobile Create Button */}
          <div className="sm:hidden mb-4">
            <Link
              href="/public/create-crew/signup"
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
              </div>

              {/* Separator */}
              <div className="hidden lg:flex items-center justify-center px-2">
                <span className="text-gray-400 font-medium text-sm">or</span>
              </div>

              {/* Filter Card 4: Race */}
              <div 
                className={`bg-white rounded-xl shadow-md p-4 border-2 transition flex-1 ${
                  activeFilterBox === 'race' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Browse by Race
                </label>
              <div className="space-y-2">
                {/* Race Name Dropdown */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Race</label>
                  <select
                    value={filterRaceId}
                    onChange={(e) => {
                      const newRaceId = e.target.value;
                      setFilterRaceId(newRaceId);
                      setFilterRaceState('');
                      setFilterRaceCity('');
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm bg-white"
                    disabled={loadingRaceData}
                  >
                    <option value="">All races</option>
                    {availableRaces.map((race) => {
                      const raceDate = race.raceDate ? new Date(race.raceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                      return (
                        <option key={race.id} value={race.id}>
                          {race.name}{raceDate ? ` (${raceDate})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* State Dropdown - only shown if race is selected */}
                {filterRaceId && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">State (optional)</label>
                    <select
                      value={filterRaceState}
                      onChange={(e) => {
                        const newState = e.target.value;
                        setFilterRaceState(newState);
                        setFilterRaceCity('');
                      }}
                      disabled={loadingRaceData || raceLocations.states.length === 0}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm bg-white disabled:opacity-50"
                    >
                      <option value="">All states</option>
                      {raceLocations.states.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* City Dropdown - only shown if state is selected */}
                {filterRaceId && filterRaceState && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">City (optional)</label>
                    <select
                      value={filterRaceCity}
                      onChange={(e) => setFilterRaceCity(e.target.value)}
                      disabled={loadingRaceData || (raceLocations.citiesByState[filterRaceState] || []).length === 0}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-sm bg-white disabled:opacity-50"
                    >
                      <option value="">All cities in {filterRaceState}</option>
                      {(raceLocations.citiesByState[filterRaceState] || []).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <button
                  onClick={() => handleActivateFilterBox('race')}
                  className="w-full mt-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
                >
                  Find
                </button>
              </div>
              {activeFilterBox === 'race' && (
                <p className="text-xs text-orange-600 mt-2">
                  ✓ Showing race training groups
                  {filterRaceId && availableRaces.find(r => r.id === filterRaceId) && ` (${availableRaces.find(r => r.id === filterRaceId)?.name})`}
                  {filterRaceState && ` in ${filterRaceState}`}
                  {filterRaceCity && `, ${filterRaceCity}`}
                </p>
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
                  {activeFilterBox
                    ? "No RunCrews found"
                    : "No RunCrews yet"}
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {activeFilterBox
                    ? "Sorry, no RunCrews exist yet in this category, but check back soon!"
                    : "Be the first to start a RunCrew and build your accountability crew!"}
                </p>
                {!activeFilterBox && (
                  <Link
                    href="/public/create-crew/signup"
                    className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
                  >
                    Start Your Crew
                  </Link>
                )}
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
                              {crew.race.raceDate && (
                                <div className="text-xs text-gray-600">
                                  {new Date(crew.race.raceDate).toLocaleDateString()}
                                  {crew.race.distanceMiles && ` • ${crew.race.distanceMiles} miles`}
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
              href="/public/create-crew/signup"
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

