'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, ImageIcon, Plus, Camera } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import GooglePlacesAutocomplete from '@/components/RunCrew/GooglePlacesAutocomplete';

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
    description: '',
    city: '',
    state: '',
    easyMilesPace: '',
    crushingItPace: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    primaryMeetUpPoint: '',
    primaryMeetUpAddress: '',
    primaryMeetUpPlaceId: '',
    primaryMeetUpLat: '',
    primaryMeetUpLng: '',
    purpose: [] as string[],
    timePreference: [] as string[],
    typicalRunMiles: '',
    longRunMilesMin: '',
    longRunMilesMax: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Crew name is required');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/runcrew/create', {
        name: formData.name,
        description: formData.description,
        logo: logo || null,
        icon: icon || null,
        city: formData.city || undefined,
        state: formData.state || undefined,
        easyMilesPace: formData.easyMilesPace || undefined,
        crushingItPace: formData.crushingItPace || undefined,
        gender: formData.gender || undefined,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
        primaryMeetUpPoint: formData.primaryMeetUpPoint || undefined,
        primaryMeetUpAddress: formData.primaryMeetUpAddress || undefined,
        primaryMeetUpPlaceId: formData.primaryMeetUpPlaceId || undefined,
        primaryMeetUpLat: formData.primaryMeetUpLat ? parseFloat(formData.primaryMeetUpLat) : undefined,
        primaryMeetUpLng: formData.primaryMeetUpLng ? parseFloat(formData.primaryMeetUpLng) : undefined,
        purpose: formData.purpose.length > 0 ? formData.purpose : undefined,
        timePreference: formData.timePreference.length > 0 ? formData.timePreference : undefined,
        typicalRunMiles: formData.typicalRunMiles ? parseFloat(formData.typicalRunMiles) : undefined,
        longRunMilesMin: formData.longRunMilesMin ? parseFloat(formData.longRunMilesMin) : undefined,
        longRunMilesMax: formData.longRunMilesMax ? parseFloat(formData.longRunMilesMax) : undefined,
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
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.push('/runcrew')} 
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <Image 
                src="/logo.jpg" 
                alt="GoFast" 
                width={24}
                height={24}
                className="w-6 h-6 rounded-full"
              />
              <span className="font-bold text-gray-900">GoFast</span>
            </div>
            <div></div>
          </div>
        </div>
      </div>

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
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Easy Miles</label>
                <input
                  type="text"
                  value={formData.easyMilesPace}
                  onChange={(e) => {
                    setFormData({ ...formData, easyMilesPace: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition font-mono"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Crushing It</label>
                <input
                  type="text"
                  value={formData.crushingItPace}
                  onChange={(e) => {
                    setFormData({ ...formData, crushingItPace: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition font-mono"
                  disabled={loading}
                />
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
                  value={formData.ageMin}
                  onChange={(e) => {
                    setFormData({ ...formData, ageMin: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  min="0"
                  max="120"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Age</label>
                <input
                  type="number"
                  value={formData.ageMax}
                  onChange={(e) => {
                    setFormData({ ...formData, ageMax: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  min="0"
                  max="120"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Purpose of Group */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Purpose of Group
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['Training', 'Fun', 'Social'] as const).map((purposeOption) => (
                <button
                  key={purposeOption}
                  type="button"
                  onClick={() => {
                    const newPurpose = formData.purpose.includes(purposeOption)
                      ? formData.purpose.filter((p) => p !== purposeOption)
                      : [...formData.purpose, purposeOption];
                    setFormData({ ...formData, purpose: newPurpose });
                    setError(null);
                  }}
                  className={`px-6 py-3 rounded-lg border-2 font-medium transition ${
                    formData.purpose.includes(purposeOption)
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
            disabled={loading || !formData.name.trim()}
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

          <button
            type="button"
            onClick={() => router.push('/runcrew')}
            className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium py-2 transition-colors"
            disabled={loading}
          >
            ← Back to RunCrew
          </button>
        </form>
      </div>
    </div>
  );
}

