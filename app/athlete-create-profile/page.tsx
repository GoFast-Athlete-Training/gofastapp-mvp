'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function AthleteCreateProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    birthday: '',
    gender: '',
    city: '',
    state: '',
    primarySport: '',
    gofastHandle: '',
    bio: '',
    instagram: '',
    profilePhoto: null as File | null,
    profilePhotoPreview: null as string | null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [handleError, setHandleError] = useState('');
  const handleCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prefill from Firebase only - localStorage is cleared during signup to ensure fresh start
  // Rules: Firebase displayName/photoURL only, then defaults (NO localStorage data)
  useEffect(() => {
    const loadAthleteData = async () => {
      const firebaseUser = auth.currentUser;
      
      // Get athleteId from localStorage (set during signup)
      const storedAthleteId = LocalStorageAPI.getAthleteId();
      
      // CRITICAL: Don't use localStorage athlete data on profile creation page
      // It may be stale from a previous session. Only use Firebase data as fallback.
      // If we have a storedAthleteId but no localStorage athlete data, that means
      // we just signed up and should start fresh (which is correct)

      if (firebaseUser) {
        // Parse Firebase displayName as fallback
        const displayName = firebaseUser.displayName || '';
        const firstNameFromFirebase = displayName.split(' ')[0] || '';
        const lastNameFromFirebase = displayName.split(' ').slice(1).join(' ') || '';
        
        console.log('🔄 PROFILE CREATE: Loading form data...');
        console.log('🔄 PROFILE CREATE: Starting fresh - only using Firebase data as fallback');
        console.log('🔄 PROFILE CREATE: Stored athleteId:', storedAthleteId);
        console.log('🔄 PROFILE CREATE: Firebase user displayName:', firebaseUser.displayName);
        console.log('🔄 PROFILE CREATE: Firebase user photoURL:', firebaseUser.photoURL);

        setFormData(prev => ({
          ...prev,
          // Email: Always from Firebase (read-only)
          email: firebaseUser.email || '',
          // Name: Only from Firebase displayName (no localStorage data)
          firstName: firstNameFromFirebase || prev.firstName,
          lastName: lastNameFromFirebase || prev.lastName,
          // Photo: Only from Firebase (no localStorage data)
          profilePhotoPreview: firebaseUser.photoURL || prev.profilePhotoPreview,
          // All other fields start empty (user will fill them out)
          // Don't pre-fill from localStorage to avoid stale data confusion
        }));
      }
    };

    loadAthleteData();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      
      setFormData(prev => ({
        ...prev,
        profilePhoto: file,
        profilePhotoPreview: previewUrl,
      }));
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Inline handle verification (debounced, like join code checking)
  const checkHandleAvailability = useCallback(async (handle: string) => {
    const normalized = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    if (!normalized || normalized.length < 2) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }

    setHandleStatus('checking');
    setHandleError('');

    try {
      const response = await api.get(`/athlete/check-handle?handle=${normalized}`);
      
      if (response.data.success) {
        if (response.data.available) {
          setHandleStatus('available');
          setHandleError('');
        } else {
          setHandleStatus('taken');
          setHandleError(`"@${normalized}" is already taken. Please choose a different handle.`);
        }
      }
    } catch (err: any) {
      console.error('Handle check error:', err);
      setHandleStatus('idle');
      // Don't show error on check failure, just allow submission
    }
  }, []);

  // Handle input change with inline verification (debounced)
  const handleHandleChange = (value: string) => {
    // Normalize handle (remove @, lowercase, alphanumeric + underscore only)
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    setFormData(prev => ({ ...prev, gofastHandle: normalized }));
    
    // Clear existing timeout
    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
    }
    
    // Reset status if handle is empty
    if (!normalized) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }
    
    // Debounce the check (wait 500ms after user stops typing)
    handleCheckTimeoutRef.current = setTimeout(() => {
      checkHandleAvailability(normalized);
    }, 500);
  };

  // Handle blur for final validation
  const handleHandleBlur = () => {
    const handle = formData.gofastHandle.trim().toLowerCase();
    
    // Clear timeout if still pending
    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
      handleCheckTimeoutRef.current = null;
    }
    
    // If handle exists and we haven't checked yet, check now
    if (handle && handleStatus === 'idle') {
      checkHandleAvailability(handle);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (handleCheckTimeoutRef.current) {
        clearTimeout(handleCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 SUBMIT: Starting profile creation...');
    console.log('📝 Form data:', formData);
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.gofastHandle || !formData.birthday || !formData.gender || !formData.city || !formData.state || !formData.primarySport) {
      setError('Please fill in all required fields');
      return;
    }

    // Check handle status
    if (handleStatus === 'taken') {
      setError('Please choose a different handle. The current handle is already taken.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Verify user is logged in
      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        setError('No user logged in. Please sign in first.');
        router.replace('/signup');
        return;
      }
      
      // Step 1: Get athlete ID from localStorage (already created during signup)
      // Don't call /athlete/create here - it could overwrite names with stale Firebase displayName
      const storedAthleteId = LocalStorageAPI.getAthleteId();
      const storedAthlete = LocalStorageAPI.getAthlete();
      
      let athleteId = storedAthleteId;
      
      // Only call /athlete/create if we don't have an athleteId
      if (!athleteId) {
        console.log('🌐 Step 1: Finding/creating athlete via /api/athlete/create (no athleteId in localStorage)');
        console.log('🔐 Axios automatically adds Firebase token (no body needed)');
        
        const res = await api.post('/athlete/create', {});
        const athleteData = res.data;
        console.log('✅ Step 1 - Athlete created/found:', athleteData);
        
        athleteId = athleteData.athleteId || athleteData.data?.id;
        if (!athleteId) {
          throw new Error('No athlete ID returned from server');
        }
      } else {
        console.log('✅ Step 1 - Using existing athleteId from localStorage:', athleteId);
      }
      
      // Step 2: Update athlete with full profile (EXACTLY like MVP1)
      console.log('🌐 Step 2: Updating profile via /api/athlete/:id/profile');
      
      const photoURL = firebaseUser.photoURL || formData.profilePhotoPreview;
      
      const profileRes = await api.put(`/athlete/${athleteId}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        gofastHandle: formData.gofastHandle.trim().toLowerCase(),
        birthday: formData.birthday,
        gender: formData.gender,
        city: formData.city,
        state: formData.state,
        primarySport: formData.primarySport,
        bio: formData.bio,
        instagram: formData.instagram,
        photoURL: photoURL,
      });
      
      const profileData = profileRes.data;
      console.log('✅ Step 2 - Profile updated:', profileData);

      // Store athlete data (EXACTLY like MVP1)
      LocalStorageAPI.setAthlete(profileData.athlete);
      LocalStorageAPI.setFullHydrationModel({
        athlete: profileData.athlete,
        weeklyActivities: [],
        weeklyTotals: {},
      });

      // Navigate to runcrew explainer page after profile setup
      console.log('🏃 Navigating to runcrew explainer page...');
      // Check for create crew intent first
      const createCrewIntent = localStorage.getItem('runCrewCreateIntent');
      if (createCrewIntent) {
        // User was creating a crew - redirect to create crew page
        localStorage.removeItem('runCrewCreateIntent');
        router.push('/runcrew/create');
      } else {
        // Check for join intent - if exists, redirect to confirm page
        const joinIntent = localStorage.getItem('runCrewJoinIntent');
        const joinIntentHandle = localStorage.getItem('runCrewJoinIntentHandle');
        if (joinIntent && joinIntentHandle) {
          // User was joining a crew - redirect to confirmation page
          router.push(`/join/runcrew/${joinIntentHandle}/confirm`);
        } else {
          // Normal flow - go to runcrew list
          router.push('/runcrew-discovery');
        }
      }
      
    } catch (err: any) {
      console.error('❌ Profile creation failed:', err);
      setLoading(false);
      
      // Handle specific error cases (EXACTLY like MVP1)
      if (err.response?.data?.error) {
        const errorData = err.response.data;
        if (errorData.field === 'gofastHandle') {
          setError(`❌ Handle taken!\n\n"@${formData.gofastHandle}" is already taken. Please choose a different handle.`);
        } else {
          setError(`❌ Profile update failed:\n\n${errorData.message || errorData.error}`);
        }
      } else if (err.response?.status === 403) {
        setError('❌ Forbidden!\n\nYou can only update your own profile. Please sign in with the correct account.');
      } else if (err.response?.status === 404) {
        setError('❌ Profile not found!\n\nYour athlete record was not found. Please try signing in again.');
      } else {
        setError(`❌ Profile creation failed:\n\n${err.message || 'Unknown error occurred'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/logo.jpg"
            alt="GoFast"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to GoFast!</h1>
          <p className="text-gray-600 mb-4">At GoFast, we believe in community. The more info you provide here, the more it fosters connections with other athletes looking to GoFast and PR.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div className="text-center">
            <div 
              className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
              onClick={handleImageClick}
            >
              {formData.profilePhotoPreview ? (
                <img 
                  src={formData.profilePhotoPreview} 
                  alt="Profile preview" 
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl">📷</span>
              )}
            </div>
            <div className="flex items-center justify-center text-orange-500 text-sm cursor-pointer hover:text-orange-600" onClick={handleImageClick}>
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              {formData.profilePhoto ? 'Change Photo' : 'Add Photo'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* First Name and Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter your first name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter your last name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Email (Read-only, prefilled) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              readOnly
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              disabled
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                disabled={loading}
              />
          </div>

          {/* Short Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about your running goals, favorite routes, or what motivates you..."
              maxLength={250}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">{formData.bio.length}/250 characters</p>
          </div>

          {/* GoFast Handle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GoFast Handle <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">This is for quick lookup and tagging others. We recommend using your first name but you can make it however you like.</p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">@</span>
              </div>
              <input
                type="text"
                value={formData.gofastHandle}
                onChange={(e) => handleHandleChange(e.target.value)}
                onBlur={handleHandleBlur}
                placeholder="your_handle"
                className={`w-full pl-8 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  handleStatus === 'taken' ? 'border-red-500' : 
                  handleStatus === 'available' ? 'border-green-500' : 
                  'border-gray-300'
                }`}
                required
                disabled={loading}
              />
            </div>
            {handleStatus === 'checking' && (
              <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
            )}
            {handleStatus === 'available' && (
              <p className="text-xs text-green-600 mt-1">✓ Handle available!</p>
            )}
            {handleError && (
              <p className="text-xs text-red-600 mt-1">{handleError}</p>
            )}
          </div>

          {/* Birthday */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Birthday <span className="text-red-500">*</span>
            </label>
            <input 
              type="date" 
              value={formData.birthday} 
              onChange={(e) => handleInputChange('birthday', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={loading}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="gender" 
                  value="male" 
                  checked={formData.gender === 'male'}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="mr-2"
                  required
                  disabled={loading}
                />
                Male
              </label>
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="gender" 
                  value="female" 
                  checked={formData.gender === 'female'}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="mr-2"
                  required
                  disabled={loading}
                />
                Female
              </label>
            </div>
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={formData.city} 
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="City"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={formData.state} 
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="State"
                maxLength={2}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Primary Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Sport <span className="text-red-500">*</span>
            </label>
            <select 
              value={formData.primarySport} 
              onChange={(e) => handleInputChange('primarySport', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={loading}
            >
              <option value="">Select your primary sport</option>
              <option value="running">🏃‍♂️ Running</option>
              <option value="cycling">🚴‍♂️ Cycling</option>
              <option value="swimming">🏊‍♂️ Swimming</option>
              <option value="triathlon">🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon</option>
              <option value="ultra-racing">🏃‍♂️ Ultra Racing</option>
              <option value="hiking">🥾 Hiking</option>
              <option value="trail-running">🏔️ Trail Running</option>
              <option value="track-field">🏃‍♂️ Track & Field</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">🎯 This helps us match you with the right community!</p>
          </div>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instagram Handle
            </label>
            <p className="text-xs text-gray-400 mb-2">In case people want to discover the real you outside of your primary sport.</p>
            <input
              type="text"
              value={formData.instagram}
              onChange={(e) => handleInputChange('instagram', e.target.value)}
              placeholder="@your_handle"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || handleStatus === 'taken'}
              className="w-full bg-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              🚀 Join the GoFast Community
            </button>
            <p className="text-center text-sm text-gray-500 mt-3">
              You can always update your profile later in settings
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
