'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, ImageIcon, Plus, Camera } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import GooglePlacesAutocomplete from '@/components/RunCrew/GooglePlacesAutocomplete';
import TopNav from '@/components/shared/TopNav';

// US States + DC for dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// Common running emojis for quick selection
const RUNNING_EMOJIS = [
  '🏃', '🏃‍♀️', '🏃‍♂️', '🏔️', '⛰️', '🌄', '🌅', '🌆',
  '🔥', '⚡', '💪', '🏆', '🎯', '🚀', '⭐', '🌟',
  '🌲', '🌳', '🌿', '🌊', '☀️', '🌙', '💫', '🌈',
  '👟', '🎽', '🏅', '🥇', '🥈', '🥉', '🎖️', '🏵️',
  '🌴', '🏖️', '⚽', '🌶️', '🍩', '🥾', '🌭', '🚀',
  '🍣', '🏆', '😍', '🐬', '⛵', '🦄', '🏄', '🏃‍♀️'
];

export default function CreateCrewPage() {
  const router = useRouter();
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logo, setLogo] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    description: '',
    city: '',
    state: '',
    easyMilesPaceMinutes: '',
    easyMilesPaceSeconds: '',
    crushingItPaceMinutes: '',
    crushingItPaceSeconds: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    primaryMeetUpPoint: '',
    primaryMeetUpAddress: '',
    primaryMeetUpPlaceId: '',
    primaryMeetUpLat: '',
    primaryMeetUpLng: '',
    purpose: '' as string, // REQUIRED: 'Training' or 'Social'
    timePreference: [] as string[],
    typicalRunMiles: '',
    longRunMilesMin: '',
    longRunMilesMax: '',
    trainingForRace: '',
  });

  // Refs for pace inputs to enable auto-advancing
  const easyMinutesRef = useRef<HTMLInputElement>(null);
  const easySecondsRef = useRef<HTMLInputElement>(null);
  const crushingMinutesRef = useRef<HTMLInputElement>(null);
  const crushingSecondsRef = useRef<HTMLInputElement>(null);

  // Race picker state (shown when Training purpose is selected)
  const [raceSearchQuery, setRaceSearchQuery] = useState('');
  const [raceSearchResults, setRaceSearchResults] = useState<any[]>([]);
  const [raceSearching, setRaceSearching] = useState(false);
  const [showCreateRaceForm, setShowCreateRaceForm] = useState(false);
  const [creatingRace, setCreatingRace] = useState(false);
  const [selectedRace, setSelectedRace] = useState<any | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isTrainingForRace, setIsTrainingForRace] = useState(false); // Toggle: Training for a race?

  // Create race form state
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDistance, setNewRaceDistance] = useState('marathon');
  const [newRaceDate, setNewRaceDate] = useState('');
  const [newRaceCity, setNewRaceCity] = useState('');
  const [newRaceState, setNewRaceState] = useState('');

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);

      // Upload to Vercel Blob via our API
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadResponse.json();
      
      if (uploadResponse.ok && uploadData.url) {
        setLogo(uploadData.url);
        // Clear icon if logo is set (mutually exclusive)
        setIcon('');
      } else {
        throw new Error(uploadData.error || 'Failed to upload logo');
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setError(err.message || 'Failed to upload logo. Please try again.');
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogo('');
    setLogoPreview(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setIcon(emoji);
    setShowEmojiPicker(false);
    // Clear logo if icon is selected (mutually exclusive)
    setLogo('');
    setLogoPreview(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
    if (logo) {
      handleRemoveLogo();
    }
  };

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
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!raceSearchQuery.trim()) {
      setRaceSearchResults([]);
      setRaceSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      handleRaceSearch(raceSearchQuery);
    }, 300);

    setDebounceTimer(timer);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [raceSearchQuery, handleRaceSearch]);

  // Handle race selection
  const handleSelectRace = (race: any) => {
    setSelectedRace(race);
    setFormData({ ...formData, trainingForRace: race.id });
    setRaceSearchQuery(race.name);
    setRaceSearchResults([]);
    setShowCreateRaceForm(false);
  };

  // Handle create race
  const handleCreateRace = async () => {
    if (!newRaceName || !newRaceDate) {
      setError('Race name and date are required');
      return;
    }

    setCreatingRace(true);
    setError(null);

    try {
      const response = await api.post('/race/create', {
        name: newRaceName,
        raceType: newRaceDistance,
        date: newRaceDate,
        city: newRaceCity || null,
        state: newRaceState || null,
        country: 'USA',
      });

      if (response.data.success && response.data.race) {
        handleSelectRace(response.data.race);
        // Reset create form
        setNewRaceName('');
        setNewRaceDate('');
        setNewRaceCity('');
        setNewRaceState('');
        setShowCreateRaceForm(false);
      } else {
        setError(response.data.error || 'Failed to create race');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create race');
    } finally {
      setCreatingRace(false);
    }
  };

  // Check if Training purpose is selected
  const isTrainingPurposeSelected = formData.purpose === 'Training';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Crew name is required');
      return;
    }

    // Validate handle format if provided
    if (formData.handle.trim()) {
      const handleRegex = /^[a-z0-9-]+$/;
      const normalizedHandle = formData.handle.toLowerCase().trim();
      if (!handleRegex.test(normalizedHandle)) {
        setError('Handle can only contain lowercase letters, numbers, and hyphens');
        return;
      }
      if (normalizedHandle.length < 3) {
        setError('Handle must be at least 3 characters long');
        return;
      }
      if (normalizedHandle.length > 50) {
        setError('Handle must be 50 characters or less');
        return;
      }
      if (normalizedHandle.startsWith('-') || normalizedHandle.endsWith('-')) {
        setError('Handle cannot start or end with a hyphen');
        return;
      }
    }

    if (!formData.purpose) {
      setError('Purpose is required');
      return;
    }

    if (formData.purpose !== 'Training' && formData.purpose !== 'Social' && formData.purpose !== 'General Fitness') {
      setError('Purpose must be Training, Social, or General Fitness');
      return;
    }

    // Validation: No race data if purpose is not Training
    if (formData.purpose !== 'Training' && formData.trainingForRace) {
      setError('Race data is only allowed when purpose is Training');
      return;
    }

    // Validation: No race data if toggle is NO
    if (formData.purpose === 'Training' && !isTrainingForRace && formData.trainingForRace) {
      setError('Race data is only allowed when "Training for a race" is selected');
      return;
    }

    // Combine pace minutes and seconds into MM:SS format
    const easyMilesPace = formData.easyMilesPaceMinutes && formData.easyMilesPaceSeconds
      ? `${formData.easyMilesPaceMinutes.padStart(2, '0')}:${formData.easyMilesPaceSeconds.padStart(2, '0')}`
      : undefined;

    const crushingItPace = formData.crushingItPaceMinutes && formData.crushingItPaceSeconds
      ? `${formData.crushingItPaceMinutes.padStart(2, '0')}:${formData.crushingItPaceSeconds.padStart(2, '0')}`
      : undefined;

    setLoading(true);

    try {
      // Convert pace from MM:SS to seconds before sending
      // The API will validate and convert, but we can do it here too for consistency
      const response = await api.post('/runcrew/create', {
        name: formData.name,
        handle: formData.handle.trim() || undefined,
        description: formData.description,
        logo: logo || null,
        icon: icon || null,
        city: formData.city || undefined,
        state: formData.state || undefined,
        easyMilesPace: easyMilesPace,
        crushingItPace: crushingItPace,
        gender: formData.gender || undefined,
        ageMin: formData.ageMin && formData.ageMin !== '' ? parseInt(formData.ageMin, 10) : undefined,
        ageMax: formData.ageMax && formData.ageMax !== '' ? parseInt(formData.ageMax, 10) : undefined,
        primaryMeetUpPoint: formData.primaryMeetUpPoint || undefined,
        primaryMeetUpAddress: formData.primaryMeetUpAddress || undefined,
        primaryMeetUpPlaceId: formData.primaryMeetUpPlaceId || undefined,
        primaryMeetUpLat: formData.primaryMeetUpLat ? parseFloat(formData.primaryMeetUpLat) : undefined,
        primaryMeetUpLng: formData.primaryMeetUpLng ? parseFloat(formData.primaryMeetUpLng) : undefined,
        purpose: [formData.purpose], // Convert to array format
        timePreference: formData.timePreference.length > 0 ? formData.timePreference : undefined,
        typicalRunMiles: formData.typicalRunMiles ? parseFloat(formData.typicalRunMiles) : undefined,
        longRunMilesMin: formData.longRunMilesMin ? parseFloat(formData.longRunMilesMin) : undefined,
        longRunMilesMax: formData.longRunMilesMax ? parseFloat(formData.longRunMilesMax) : undefined,
        // Only include trainingForRace if purpose is Training AND toggle is YES
        trainingForRace: (formData.purpose === 'Training' && isTrainingForRace && formData.trainingForRace) ? formData.trainingForRace : undefined,
        trainingForDistance: undefined, // Not in MVP
      });
      
      if (response.data.success) {
        const createdCrew = response.data.runCrew;
        
        // Store crew data for success page
        const crewData = {
          id: createdCrew.id,
          name: createdCrew.name,
          joinCode: createdCrew.joinCode,
          description: createdCrew.description,
          logo: createdCrew.logo || logo,
          icon: createdCrew.icon || icon,
        };
        localStorage.setItem('currentCrew', JSON.stringify(crewData));
        
        // CRITICAL: Set crew ID immediately so athlete-home can find it
        LocalStorageAPI.setRunCrewId(createdCrew.id);
        LocalStorageAPI.setMyCrew(createdCrew.id);
        
        // If user is admin (they just created it), set manager ID
        // We'll get the actual manager ID from hydration, but set a flag for now
        LocalStorageAPI.setRunCrewData(createdCrew);
        
        // CRITICAL: Hydrate athlete to update localStorage with new crew membership
        try {
          console.log('🔄 CREATING CREW: Hydrating athlete to update localStorage...');
          const hydrateResponse = await api.post('/athlete/hydrate');
          
          if (hydrateResponse.data.success && hydrateResponse.data.athlete) {
            const { athlete } = hydrateResponse.data;
            
            // Store full hydration model (includes crew memberships and MyCrew)
            LocalStorageAPI.setFullHydrationModel({
              athlete,
              weeklyActivities: hydrateResponse.data.weeklyActivities || [],
              weeklyTotals: hydrateResponse.data.weeklyTotals || null,
            });
            
            // Also store crew data directly (hydration might have more complete data)
            if (athlete.MyCrew && athlete.runCrewMemberships) {
              const crewMembership = athlete.runCrewMemberships.find(
                (m: any) => m.runCrew?.id === athlete.MyCrew || m.runCrewId === athlete.MyCrew
              );
              if (crewMembership?.runCrew) {
                LocalStorageAPI.setRunCrewData(crewMembership.runCrew);
              }
            } else {
              LocalStorageAPI.setRunCrewData(createdCrew);
            }
            
            console.log('✅ CREATING CREW: Athlete hydrated');
            console.log('✅ CREATING CREW: MyCrew:', athlete.MyCrew);
            console.log('✅ CREATING CREW: MyCrewManagerId:', athlete.MyCrewManagerId);
            console.log('✅ CREATING CREW: Crew should now appear on athlete-home');
          }
        } catch (hydrateError) {
          console.error('⚠️ CREATING CREW: Failed to hydrate athlete:', hydrateError);
          // Continue anyway - crew is created and ID is set, user can refresh
        }
        
        // Route to success page, then admin dashboard
        router.push(`/runcrew/success?crewId=${createdCrew.id}`);
      }
    } catch (error: any) {
      console.error('Error creating crew:', error);
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to create crew');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-sky-100">
      <TopNav showBack={true} backUrl="/runcrew" backLabel="Back to Discovery" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your RunCrew</h1>
          <p className="text-gray-600 mb-3">
            This is your crew — your friends, your accountability partners, your running family.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Crew Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setError(null);
              }}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Public URL Handle <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.handle}
              onChange={(e) => {
                // Auto-convert to lowercase and remove invalid characters
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                setFormData({ ...formData, handle: value });
                setError(null);
              }}
              placeholder="e.g., boston-runners"
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Used for your public URL: /join/runcrew/[handle]. If left empty, one will be auto-generated from your crew name.
            </p>
            {formData.handle && (
              <p className="mt-1 text-xs text-sky-600">
                Your URL will be: <span className="font-mono">/join/runcrew/{formData.handle.toLowerCase().trim()}</span>
              </p>
            )}
          </div>

          {/* RunCrew Graphic - iPhone style */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              RunCrew Graphic
            </label>
            
            {/* Current selection preview */}
            {(icon || logoPreview || logo) && (
              <div className="mb-4 flex justify-center">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gray-200">
                  {logoPreview || logo ? (
                    <>
                      <img
                        src={logoPreview || logo}
                        alt="Crew graphic"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        disabled={uploadingLogo || loading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-5xl">
                      {icon}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons row - iPhone style */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {/* Photo upload button */}
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                disabled={uploadingLogo || loading || !!icon}
                className="w-14 h-14 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingLogo ? (
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-blue-600" />
                )}
              </button>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploadingLogo || loading || !!icon}
              />

              {/* Emoji picker toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  if (logo || logoPreview) {
                    setLogo('');
                    setLogoPreview(null);
                  }
                }}
                disabled={loading}
                className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
              >
                <span className="text-2xl">😊</span>
              </button>
            </div>

            {/* Emoji grid - iPhone style */}
            {showEmojiPicker && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="grid grid-cols-8 gap-2">
                  {RUNNING_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleEmojiSelect(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="w-12 h-12 text-3xl hover:bg-white hover:scale-110 rounded-lg transition flex items-center justify-center"
                      disabled={loading}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setError(null);
              }}
              rows={3}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
              disabled={loading}
            />
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => {
                  setFormData({ ...formData, city: e.target.value });
                  setError(null);
                }}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State
              </label>
              <select
                value={formData.state}
                onChange={(e) => {
                  setFormData({ ...formData, state: e.target.value });
                  setError(null);
                }}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                disabled={loading}
              >
                <option value="">Select a state</option>
                {US_STATES.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pace Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pace
            </label>
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-600 mb-2">Easy Miles</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                    <input
                      ref={easyMinutesRef}
                      type="number"
                      min="0"
                      max="59"
                      value={formData.easyMilesPaceMinutes}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setFormData({ ...formData, easyMilesPaceMinutes: val });
                          setError(null);
                          // Auto-advance to seconds when 2 digits entered
                          if (val.length === 2 && easySecondsRef.current) {
                            easySecondsRef.current.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey && easySecondsRef.current) {
                          e.preventDefault();
                          easySecondsRef.current.focus();
                        }
                      }}
                      placeholder="8"
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-center"
                      disabled={loading}
                    />
                  </div>
                  <div className="pt-6 text-xl font-bold text-gray-400">:</div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                    <input
                      ref={easySecondsRef}
                      type="number"
                      min="0"
                      max="59"
                      value={formData.easyMilesPaceSeconds}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setFormData({ ...formData, easyMilesPaceSeconds: val });
                          setError(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && e.shiftKey && easyMinutesRef.current) {
                          e.preventDefault();
                          easyMinutesRef.current.focus();
                        }
                      }}
                      placeholder="00"
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-center"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-2">Crushing It</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                    <input
                      ref={crushingMinutesRef}
                      type="number"
                      min="0"
                      max="59"
                      value={formData.crushingItPaceMinutes}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setFormData({ ...formData, crushingItPaceMinutes: val });
                          setError(null);
                          // Auto-advance to seconds when 2 digits entered
                          if (val.length === 2 && crushingSecondsRef.current) {
                            crushingSecondsRef.current.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey && crushingSecondsRef.current) {
                          e.preventDefault();
                          crushingSecondsRef.current.focus();
                        }
                      }}
                      placeholder="7"
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-center"
                      disabled={loading}
                    />
                  </div>
                  <div className="pt-6 text-xl font-bold text-gray-400">:</div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                    <input
                      ref={crushingSecondsRef}
                      type="number"
                      min="0"
                      max="59"
                      value={formData.crushingItPaceSeconds}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setFormData({ ...formData, crushingItPaceSeconds: val });
                          setError(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && e.shiftKey && crushingMinutesRef.current) {
                          e.preventDefault();
                          crushingMinutesRef.current.focus();
                        }
                      }}
                      placeholder="00"
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-center"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gender
            </label>
            <div className="flex gap-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={(e) => {
                    setFormData({ ...formData, gender: e.target.value });
                    setError(null);
                  }}
                  className="w-4 h-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">Male</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={(e) => {
                    setFormData({ ...formData, gender: e.target.value });
                    setError(null);
                  }}
                  className="w-4 h-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">Female</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="both"
                  checked={formData.gender === 'both'}
                  onChange={(e) => {
                    setFormData({ ...formData, gender: e.target.value });
                    setError(null);
                  }}
                  className="w-4 h-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">Both</span>
              </label>
            </div>
          </div>

          {/* Age Range Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Age</label>
                <input
                  type="number"
                  value={formData.ageMin === '' ? '' : formData.ageMin}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, ageMin: value === '' ? '' : value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  min="0"
                  max="120"
                  placeholder="18"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Age</label>
                <input
                  type="number"
                  value={formData.ageMax === '' ? '' : formData.ageMax}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, ageMax: value === '' ? '' : value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  min="0"
                  max="120"
                  placeholder="65"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Purpose of Group - REQUIRED */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Purpose of Group <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['Training', 'Social', 'General Fitness'] as const).map((purposeOption) => (
                <button
                  key={purposeOption}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, purpose: purposeOption });
                    // Clear race data if switching away from Training
                    if (purposeOption !== 'Training') {
                      setFormData({ ...formData, purpose: purposeOption, trainingForRace: '' });
                      setSelectedRace(null);
                      setRaceSearchQuery('');
                      setIsTrainingForRace(false);
                    }
                    setError(null);
                  }}
                  className={`px-6 py-3 rounded-lg border-2 font-medium transition ${
                    formData.purpose === purposeOption
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-sky-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={loading}
                >
                  {purposeOption}
                </button>
              ))}
            </div>
          </div>

          {/* Training for Race Toggle - ONLY if purpose = Training */}
          {isTrainingPurposeSelected && (
            <div className="bg-sky-50 border-2 border-sky-200 rounded-lg p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Training for a race?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTrainingForRace(true);
                      setError(null);
                    }}
                    className={`px-6 py-3 rounded-lg border-2 font-medium transition ${
                      isTrainingForRace
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-sky-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={loading}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTrainingForRace(false);
                      setFormData({ ...formData, trainingForRace: '' });
                      setSelectedRace(null);
                      setRaceSearchQuery('');
                      setError(null);
                    }}
                    className={`px-6 py-3 rounded-lg border-2 font-medium transition ${
                      !isTrainingForRace
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-sky-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={loading}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Race Picker - ONLY if purpose = Training AND toggle = YES */}
              {isTrainingForRace && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Race (Optional)
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Search for a race or create a new one
                    </p>

                    {selectedRace ? (
                  <div className="bg-white border-2 border-sky-500 rounded-lg p-4 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{selectedRace.name}</div>
                        <div className="text-sm text-gray-600">
                          {selectedRace.raceType?.toUpperCase()} ({selectedRace.miles} miles) • {formatRaceDate(selectedRace.date)}
                          {selectedRace.city && ` • ${selectedRace.city}, ${selectedRace.state || selectedRace.country}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRace(null);
                          setFormData({ ...formData, trainingForRace: '' });
                          setRaceSearchQuery('');
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Race Search */}
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={raceSearchQuery}
                        onChange={(e) => setRaceSearchQuery(e.target.value)}
                        placeholder="Type to search for a race (e.g., Boston Marathon)"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                        disabled={loading}
                      />
                      {raceSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500"></div>
                        </div>
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {raceSearchQuery.trim() && raceSearchResults.length > 0 && (
                      <div className="border-2 border-gray-200 rounded-lg bg-white max-h-64 overflow-y-auto mb-3">
                        {raceSearchResults.map((race) => (
                          <button
                            key={race.id}
                            type="button"
                            onClick={() => handleSelectRace(race)}
                            className="w-full text-left p-4 hover:bg-sky-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-semibold text-gray-900">{race.name}</div>
                            <div className="text-sm text-gray-600">
                              {race.raceType?.toUpperCase()} ({race.miles} miles) • {formatRaceDate(race.date)}
                              {race.city && ` • ${race.city}, ${race.state || race.country}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No Results / Create New */}
                    {raceSearchQuery.trim() && !raceSearching && raceSearchResults.length === 0 && raceSearchQuery.length >= 2 && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-3">
                        <p className="text-sm text-blue-900 mb-2">No races found</p>
                        <button
                          type="button"
                          onClick={() => {
                            setNewRaceName(raceSearchQuery.trim());
                            setShowCreateRaceForm(true);
                          }}
                          className="w-full bg-sky-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-sky-600 transition"
                        >
                          Create "{raceSearchQuery.trim()}"
                        </button>
                      </div>
                    )}

                    {/* Divider */}
                    {!showCreateRaceForm && (
                      <div className="flex items-center gap-4 my-4">
                        <div className="flex-1 h-px bg-gray-300"></div>
                        <span className="text-gray-500 font-semibold text-sm">OR</span>
                        <div className="flex-1 h-px bg-gray-300"></div>
                      </div>
                    )}

                    {/* Create Race Form */}
                    {showCreateRaceForm ? (
                      <div className="space-y-4 bg-white rounded-lg p-4 border-2 border-gray-200">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Race Name *
                          </label>
                          <input
                            type="text"
                            value={newRaceName}
                            onChange={(e) => setNewRaceName(e.target.value)}
                            placeholder="e.g., Boston Marathon 2025"
                            className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                            disabled={loading || creatingRace}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Distance *
                            </label>
                            <select
                              value={newRaceDistance}
                              onChange={(e) => setNewRaceDistance(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                              disabled={loading || creatingRace}
                            >
                              <option value="5k">5K</option>
                              <option value="10k">10K</option>
                              <option value="half">Half Marathon</option>
                              <option value="marathon">Marathon</option>
                              <option value="ultra">Ultra</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Race Date *
                            </label>
                            <input
                              type="date"
                              value={newRaceDate}
                              onChange={(e) => setNewRaceDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                              disabled={loading || creatingRace}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={newRaceCity}
                              onChange={(e) => setNewRaceCity(e.target.value)}
                              placeholder="City"
                              className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                              disabled={loading || creatingRace}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              State
                            </label>
                            <select
                              value={newRaceState}
                              onChange={(e) => setNewRaceState(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-sky-500 focus:outline-none"
                              disabled={loading || creatingRace}
                            >
                              <option value="">Select State</option>
                              {US_STATES.map((state) => (
                                <option key={state.value} value={state.value}>
                                  {state.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateRaceForm(false);
                              setNewRaceName('');
                              setNewRaceDate('');
                              setNewRaceCity('');
                              setNewRaceState('');
                            }}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition"
                            disabled={loading || creatingRace}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateRace}
                            disabled={creatingRace || !newRaceName || !newRaceDate}
                            className="flex-1 bg-sky-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-sky-600 transition disabled:opacity-50"
                          >
                            {creatingRace ? 'Creating...' : 'Create Race'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCreateRaceForm(true)}
                        className="w-full bg-white border-2 border-sky-500 text-sky-600 py-3 px-6 rounded-lg font-semibold hover:bg-sky-50 transition"
                        disabled={loading}
                      >
                        + Create New Race
                      </button>
                    )}
                  </>
                  )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Preference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Typical Run Times
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['Morning', 'Afternoon', 'Evening'] as const).map((timeOption) => (
                <button
                  key={timeOption}
                  type="button"
                  onClick={() => {
                    const newTimePreference = formData.timePreference.includes(timeOption)
                      ? formData.timePreference.filter((t) => t !== timeOption)
                      : [...formData.timePreference, timeOption];
                    setFormData({ ...formData, timePreference: newTimePreference });
                    setError(null);
                  }}
                  className={`px-6 py-3 rounded-lg border-2 font-medium transition ${
                    formData.timePreference.includes(timeOption)
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-sky-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={loading}
                >
                  {timeOption}
                </button>
              ))}
            </div>
          </div>

          {/* Run Distance Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Typical Run Distance
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Average Typical Run (miles)</label>
                <input
                  type="number"
                  value={formData.typicalRunMiles}
                  onChange={(e) => {
                    setFormData({ ...formData, typicalRunMiles: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  step="0.1"
                  min="0"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Long Run Range (miles)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <input
                      type="number"
                      value={formData.longRunMilesMin}
                      onChange={(e) => {
                        setFormData({ ...formData, longRunMilesMin: e.target.value });
                        setError(null);
                      }}
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                      step="0.1"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <input
                      type="number"
                      value={formData.longRunMilesMax}
                      onChange={(e) => {
                        setFormData({ ...formData, longRunMilesMax: e.target.value });
                        setError(null);
                      }}
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                      step="0.1"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Meetup Point */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Primary Meetup Point
            </label>
            <GooglePlacesAutocomplete
              value={formData.primaryMeetUpAddress}
              onChange={(e) => {
                setFormData({ ...formData, primaryMeetUpAddress: e.target.value });
                setError(null);
              }}
              onPlaceSelected={(placeData) => {
                setFormData({
                  ...formData,
                  primaryMeetUpPoint: placeData.name,
                  primaryMeetUpAddress: placeData.address,
                  primaryMeetUpPlaceId: placeData.placeId,
                  primaryMeetUpLat: placeData.lat.toString(),
                  primaryMeetUpLng: placeData.lng.toString(),
                });
              }}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name.trim() || !formData.purpose}
            className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold py-4 rounded-lg transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Crew...
              </span>
            ) : (
              'Create RunCrew'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

