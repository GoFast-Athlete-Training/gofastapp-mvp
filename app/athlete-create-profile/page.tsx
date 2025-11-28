'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
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

  // Load Firebase photo if available
  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser?.photoURL) {
      setFormData(prev => ({
        ...prev,
        profilePhotoPreview: firebaseUser.photoURL || null,
      }));
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 SUBMIT: Starting profile creation...');
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.gofastHandle || !formData.birthday || !formData.gender || !formData.city || !formData.state || !formData.primarySport) {
      setError('Please fill in all required fields');
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
      
      // Step 1: Find or create athlete
      console.log('🌐 Step 1: Finding/creating athlete via /api/athlete/create');
      const res = await api.post('/athlete/create', {});
      const athleteData = res.data;
      console.log('✅ Step 1 - Athlete created/found:', athleteData);
      
      // Get athlete ID from response
      const athleteId = athleteData.athleteId || athleteData.data?.id;
      if (!athleteId) {
        throw new Error('No athlete ID returned from server');
      }
      
      // Step 2: Update athlete with full profile
      console.log('🌐 Step 2: Updating profile via /api/athlete/:id/profile');
      
      const photoURL = firebaseUser.photoURL || formData.profilePhotoPreview;
      
      const profileRes = await api.put(`/athlete/${athleteId}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        gofastHandle: formData.gofastHandle,
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
      
      // Store athlete data
      LocalStorageAPI.setAthleteId(athleteId);
      LocalStorageAPI.setAthlete(profileData.athlete);

      // Navigate to athlete home after profile setup
      console.log('🏠 Navigating to athlete home...');
      router.replace('/athlete-home');
      
    } catch (err: any) {
      console.error('❌ Profile creation failed:', err);
      setLoading(false);
      
      // Handle specific error cases
      if (err.response?.data?.error) {
        const errorData = err.response.data;
        if (errorData.field === 'gofastHandle') {
          setError(`Handle "@${formData.gofastHandle}" is already taken. Please choose a different handle.`);
        } else {
          setError(errorData.message || errorData.error);
        }
      } else if (err.response?.status === 403) {
        setError('You can only update your own profile. Please sign in with the correct account.');
      } else if (err.response?.status === 404) {
        setError('Your athlete record was not found. Please try signing in again.');
      } else {
        setError(err.message || 'Unknown error occurred');
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
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800 text-sm font-medium">💡 <strong>Community Tip:</strong> Complete profiles get 3x more crew invites and running partner matches!</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
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

          {/* GoFast Handle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GoFast Handle <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <span className="text-gray-500 mr-2">@</span>
              <input
                type="text"
                value={formData.gofastHandle}
                onChange={(e) => handleInputChange('gofastHandle', e.target.value.replace('@', ''))}
                placeholder="username"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">This is your unique identifier on GoFast</p>
          </div>

          {/* Birthday and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter your city"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="Enter your state"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Primary Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Sport <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.primarySport}
              onChange={(e) => handleInputChange('primarySport', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={loading}
            >
              <option value="">Select primary sport</option>
              <option value="running">Running</option>
              <option value="cycling">Cycling</option>
              <option value="swimming">Swimming</option>
              <option value="triathlon">Triathlon</option>
              <option value="other">Other</option>
            </select>
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

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={loading}
            />
          </div>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instagram
            </label>
            <input
              type="text"
              value={formData.instagram}
              onChange={(e) => handleInputChange('instagram', e.target.value.replace('@', ''))}
              placeholder="username"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-orange-700 hover:to-orange-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Creating Profile...
              </span>
            ) : (
              'Complete Profile →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

