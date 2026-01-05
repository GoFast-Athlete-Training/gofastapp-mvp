'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, ImageIcon } from 'lucide-react';
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
  '🌲', '🌳', '🌿', '🌊', '☀️', '🌙', '⭐', '💫',
  '👟', '🎽', '🏅', '🥇', '🥈', '🥉', '🎖️', '🏵️'
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
    joinCode: '',
    city: '',
    state: '',
    paceMin: '',
    paceMax: '',
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
    // Clear logo if icon is selected
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
    
    if (!formData.joinCode.trim()) {
      setError('Join code is required');
      return;
    }

    const normalizedCode = formData.joinCode.toUpperCase().trim();
    if (normalizedCode.length < 3) {
      setError('Join code must be at least 3 characters');
      return;
    }
    if (normalizedCode.length > 20) {
      setError('Join code must be 20 characters or less');
      return;
    }
    if (!/^[A-Z0-9-_]+$/.test(normalizedCode)) {
      setError('Join code can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    setLoading(true);

    // Convert pace from MM:SS format to seconds per mile
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

    try {
      const response = await api.post('/runcrew/create', {
        name: formData.name,
        description: formData.description,
        joinCode: normalizedCode,
        logo: logo || null,
        icon: icon || null,
        city: formData.city || undefined,
        state: formData.state || undefined,
        paceMin: formData.paceMin ? convertPaceToSeconds(formData.paceMin) : undefined,
        paceMax: formData.paceMax ? convertPaceToSeconds(formData.paceMax) : undefined,
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
          joinCode: createdCrew.joinCode || normalizedCode,
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
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-left">
            <p className="text-sm text-sky-800 font-medium mb-1">💡 Make it fun and memorable!</p>
            <p className="text-xs text-sky-700">
              Choose a name and join code that your crew will remember. This is how you'll recognize each other and build your running community.
            </p>
          </div>
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
              placeholder="e.g. Morning Warriors, Trail Runners, Weekend Warriors"
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Pick something your crew will remember and get excited about</p>
          </div>

          {/* RunCrew Graphic */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              RunCrew Graphic <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            
            {/* Split screen layout - side by side on larger screens, stacked on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Emoji Card */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition cursor-pointer" onClick={() => !showEmojiPicker && setShowEmojiPicker(true)}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Emoji</h3>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-4xl border-2 border-gray-200">
                    {icon || '🏃'}
                  </div>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => {
                      setIcon(e.target.value);
                      // Clear logo when emoji is set
                      if (e.target.value) {
                        setLogo('');
                        setLogoPreview(null);
                      }
                    }}
                    placeholder="🏃"
                    maxLength={2}
                    className="w-24 text-center px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-2xl"
                    onClick={(e) => e.stopPropagation()}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition text-sm"
                    disabled={loading}
                  >
                    {showEmojiPicker ? 'Hide' : 'Browse'}
                  </button>
                </div>
                
                {showEmojiPicker && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">Quick pick:</p>
                    <div className="grid grid-cols-6 gap-2">
                      {RUNNING_EMOJIS.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEmojiSelect(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="w-10 h-10 text-2xl hover:bg-white hover:scale-110 rounded-lg transition"
                          disabled={loading}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Or type any emoji above
                    </p>
                  </div>
                )}
              </div>

              {/* Add Logo Card */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Logo</h3>
                <div className="flex flex-col items-center gap-3">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        disabled={uploadingLogo || loading}
                        title="Remove logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : logo ? (
                    <div className="relative">
                      <img
                        src={logo}
                        alt="Logo"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        disabled={uploadingLogo || loading}
                        title="Remove logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={uploadingLogo || loading || !!icon}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {uploadingLogo ? 'Uploading...' : 'Upload Photo'}
                  </button>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo || loading || !!icon}
                  />
                  <p className="text-xs text-gray-500 text-center">
                    JPG, PNG - max 5MB
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setError(null);
              }}
              rows={3}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
              placeholder="What makes your crew special? What are your goals? (optional)"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Help your crew understand what you're all about</p>
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => {
                  setFormData({ ...formData, city: e.target.value });
                  setError(null);
                }}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                placeholder="Arlington"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State <span className="text-gray-400 text-xs">(Optional)</span>
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

          {/* Pace Range Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pace Range <span className="text-gray-400 text-xs">(Optional - min/mile)</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Pace</label>
                <input
                  type="text"
                  value={formData.paceMin}
                  onChange={(e) => {
                    setFormData({ ...formData, paceMin: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition font-mono"
                  placeholder="8:00"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Format: MM:SS</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Pace</label>
                <input
                  type="text"
                  value={formData.paceMax}
                  onChange={(e) => {
                    setFormData({ ...formData, paceMax: e.target.value });
                    setError(null);
                  }}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition font-mono"
                  placeholder="10:00"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Format: MM:SS</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Target pace range for your crew (e.g., 8:00-10:00 min/mile)</p>
          </div>

          {/* Gender Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gender <span className="text-gray-400 text-xs">(Optional)</span>
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
            <p className="text-xs text-gray-500 mt-1">Select the gender(s) welcome in your crew</p>
          </div>

          {/* Age Range Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age Range <span className="text-gray-400 text-xs">(Optional)</span>
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
                  placeholder="18"
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
                  placeholder="65"
                  min="0"
                  max="120"
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Age range for your crew (optional)</p>
          </div>

          {/* Purpose of Group */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Purpose of Group <span className="text-gray-400 text-xs">(Optional - Select all that apply)</span>
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
            <p className="text-xs text-gray-500 mt-2">Select what your crew is all about</p>
          </div>

          {/* Time Preference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Typical Run Times <span className="text-gray-400 text-xs">(Optional - Select all that apply)</span>
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
            <p className="text-xs text-gray-500 mt-2">When does your crew typically run?</p>
          </div>

          {/* Run Distance Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Typical Run Distance <span className="text-gray-400 text-xs">(Optional)</span>
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
                  placeholder="6.0"
                  step="0.1"
                  min="0"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Average distance for a typical run</p>
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
                      placeholder="13"
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
                      placeholder="18"
                      step="0.1"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Long run distance range (e.g., 13-18 miles for serious training vs 6 for a bagel stop)</p>
              </div>
            </div>
          </div>

          {/* Primary Meetup Point */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Primary Meetup Point <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Where does your crew typically meet? This helps with radius-based search.</p>
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
              placeholder="Search for a location (e.g., park, running trail, coffee shop)..."
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Type to search or enter address manually</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Join Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.joinCode}
              onChange={(e) => {
                setFormData({ ...formData, joinCode: e.target.value.toUpperCase() });
                setError(null);
              }}
              className="w-full p-4 border-2 border-gray-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              placeholder="FAST123"
              maxLength={20}
              disabled={loading}
              required
            />
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">🔑 What is a Join Code?</p>
              <p className="text-xs text-blue-800">
                This is how your friends will join your crew. Share this code with them, and they can enter it to join. 
                Make it something easy to remember — like your crew name initials or a fun word!
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              3-20 characters, letters and numbers only (no spaces)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name.trim() || !formData.joinCode.trim()}
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

