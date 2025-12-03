'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function AthleteEditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
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
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load existing profile data
  useEffect(() => {
    const loadProfile = () => {
      try {
        const stored = LocalStorageAPI.getAthlete();
        const storedAthleteId = LocalStorageAPI.getAthleteId();

        if (!stored || !storedAthleteId) {
          console.warn('⚠️ EDIT PROFILE: Missing profile or athleteId, routing to welcome');
          router.replace('/athlete-welcome');
          return;
        }

        setAthleteId(storedAthleteId);

        // Pre-fill form with existing data
        setFormData({
          firstName: stored.firstName || '',
          lastName: stored.lastName || '',
          phoneNumber: stored.phoneNumber || '',
          birthday: stored.birthday ? new Date(stored.birthday).toISOString().split('T')[0] : '',
          gender: stored.gender || '',
          city: stored.city || '',
          state: stored.state || '',
          primarySport: stored.primarySport || '',
          gofastHandle: stored.gofastHandle || '',
          bio: stored.bio || '',
          instagram: stored.instagram || '',
          profilePhoto: null,
          profilePhotoPreview: stored.photoURL || auth.currentUser?.photoURL || null
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading profile:', error);
        setError('Error loading profile. Please try again.');
        router.push('/profile');
      }
    };

    loadProfile();
  }, [router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 SUBMIT: Updating profile...');
    console.log('📝 Form data:', formData);
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.gofastHandle || !formData.birthday || !formData.gender || !formData.city || !formData.state || !formData.primarySport) {
      setError('Please fill in all required fields');
      return;
    }

    if (!athleteId) {
      setError('Athlete ID not found. Please refresh and try again.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        setError('No user logged in. Please sign in first.');
        router.replace('/signup');
        return;
      }

      // Update profile - overwrites existing data
      console.log('🌐 Updating profile via /api/athlete/:id/profile');
      
      const photoURL = formData.profilePhotoPreview || firebaseUser.photoURL || null;
      
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
        photoURL: photoURL
      });
      
      const profileData = profileRes.data;
      console.log('✅ Profile updated:', profileData);
      
      // Update localStorage with new data
      LocalStorageAPI.setAthlete(profileData.athlete);

      // Navigate back to profile page
      console.log('🏠 Navigating back to profile...');
      router.push('/profile');
      
    } catch (err: any) {
      console.error('❌ Profile update failed:', err);
      setLoading(false);
      
      // Handle specific error cases
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
        setError(`❌ Profile update failed:\n\n${err.message || 'Unknown error occurred'}`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Your Profile</h1>
          <p className="text-gray-600 mb-4">Update your information to keep your profile current and help others find you.</p>
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
              className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden"
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
              {formData.profilePhotoPreview ? 'Change Photo' : 'Add Photo'}
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

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="(555) 123-4567"
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
                onChange={(e) => handleInputChange('gofastHandle', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_handle"
                className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
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
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/profile')}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-700 py-4 px-6 rounded-lg font-bold text-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

