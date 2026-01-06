'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import { Search, MapPin, Users, Clock, Target } from 'lucide-react';

interface DiscoverableRunCrew {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  icon: string | null;
  city: string | null;
  state: string | null;
  paceAverage: string | null;
  paceRange: string | null; // Deprecated - use paceAverage
  gender: string | null;
  ageRange: string | null;
  primaryMeetUpPoint: string | null;
  primaryMeetUpAddress: string | null;
  purpose: string[] | null;
  timePreference: string[] | null;
  typicalRunMiles: number | null;
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
  const [filterTimePreference, setFilterTimePreference] = useState<string[]>([]);
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterTypicalRunMilesMin, setFilterTypicalRunMilesMin] = useState('');
  const [filterTypicalRunMilesMax, setFilterTypicalRunMilesMax] = useState('');
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRunCrews();
  }, []);

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
      if (filterCity) params.append('city', filterCity);
      if (filterState) params.append('state', filterState);
      
      // Purpose filters
      filterPurpose.forEach(p => params.append('purpose', p));
      
      // Time preference filters
      filterTimePreference.forEach(t => params.append('timePreference', t));
      
      // TODO: Pace filtering removed - new pace model (paceAverage, easyMilesPace, crushingItPace)
      // doesn't support min/max filtering. Re-implement if needed.
      
      // Gender filter
      if (filterGender) params.append('gender', filterGender);
      
      // Age filters
      if (filterAgeMin) params.append('ageMin', filterAgeMin);
      if (filterAgeMax) params.append('ageMax', filterAgeMax);
      
      // Typical run miles filters
      if (filterTypicalRunMilesMin) params.append('typicalRunMilesMin', filterTypicalRunMilesMin);
      if (filterTypicalRunMilesMax) params.append('typicalRunMilesMax', filterTypicalRunMilesMax);
      
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

  // Filter crews based on search query
  const filteredCrews = runCrews.filter((crew) => {
    const query = searchQuery.toLowerCase();
    return (
      crew.name.toLowerCase().includes(query) ||
      crew.description?.toLowerCase().includes(query) ||
      crew.city?.toLowerCase().includes(query) ||
      crew.state?.toLowerCase().includes(query) ||
      crew.primaryMeetUpPoint?.toLowerCase().includes(query)
    );
  });

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

          {/* Search */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, location, or description..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Filters Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <span>Filters</span>
              <svg
                className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 space-y-6 mb-8">
              {/* Location Filters */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                </div>
              </div>

              {/* Purpose Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Purpose</h3>
                <div className="flex gap-3 flex-wrap">
                  {(['Training', 'Fun', 'Social'] as const).map((purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => {
                        setFilterPurpose(
                          filterPurpose.includes(purpose)
                            ? filterPurpose.filter((p) => p !== purpose)
                            : [...filterPurpose, purpose]
                        );
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
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

              {/* Time Preference Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Run Times</h3>
                <div className="flex gap-3 flex-wrap">
                  {(['Morning', 'Afternoon', 'Evening'] as const).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setFilterTimePreference(
                          filterTimePreference.includes(time)
                            ? filterTimePreference.filter((t) => t !== time)
                            : [...filterTimePreference, time]
                        );
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
                        filterTimePreference.includes(time)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-500'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Gender</h3>
                <div className="flex gap-6">
                  {(['male', 'female', 'both'] as const).map((gender) => (
                    <label key={gender} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={filterGender === gender}
                        onChange={(e) => setFilterGender(e.target.value)}
                        className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{gender}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFilterGender('')}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Age Range Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Age Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Min Age</label>
                    <input
                      type="number"
                      value={filterAgeMin}
                      onChange={(e) => setFilterAgeMin(e.target.value)}
                      placeholder="18"
                      min="0"
                      max="120"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Age</label>
                    <input
                      type="number"
                      value={filterAgeMax}
                      onChange={(e) => setFilterAgeMax(e.target.value)}
                      placeholder="65"
                      min="0"
                      max="120"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Typical Run Miles Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Typical Run Distance (miles)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Min Miles</label>
                    <input
                      type="number"
                      value={filterTypicalRunMilesMin}
                      onChange={(e) => setFilterTypicalRunMilesMin(e.target.value)}
                      placeholder="3.0"
                      step="0.1"
                      min="0"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Miles</label>
                    <input
                      type="number"
                      value={filterTypicalRunMilesMax}
                      onChange={(e) => setFilterTypicalRunMilesMax(e.target.value)}
                      placeholder="10.0"
                      step="0.1"
                      min="0"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Apply Filters Button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleApplyFilters}
                  disabled={applyingFilters}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applyingFilters ? 'Applying Filters...' : 'Apply Filters'}
                </button>
                <button
                  onClick={() => {
                    setFilterCity('');
                    setFilterState('');
                    setFilterPurpose([]);
                    setFilterTimePreference([]);
                    setFilterGender('');
                    setFilterAgeMin('');
                    setFilterAgeMax('');
                    setFilterTypicalRunMilesMin('');
                    setFilterTypicalRunMilesMax('');
                    fetchRunCrews();
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
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
