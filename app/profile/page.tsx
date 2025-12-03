'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function ProfilePage() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load athlete profile from localStorage (hydrated from athlete home)
    const stored = LocalStorageAPI.getAthlete();
    if (stored) {
      setAthleteProfile(stored);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!athleteProfile) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p>Please sign in</p>
      </div>
    );
  }

  // Calculate age from birthday
  const calculateAge = (birthday: string | Date | null) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(athleteProfile.birthday);

  // Count how many profile fields are filled
  const filledFields = [
    athleteProfile?.bio,
    athleteProfile?.city || athleteProfile?.state,
    athleteProfile?.primarySport,
    athleteProfile?.birthday,
    athleteProfile?.gender,
    athleteProfile?.instagram,
    athleteProfile?.phoneNumber,
    athleteProfile?.email,
    athleteProfile?.gofastHandle,
  ].filter(Boolean).length;

  const isProfileSparse = filledFields <= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/logo.jpg"
                alt="GoFast"
                width={32}
                height={32}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-xl font-bold text-gray-900">Profile</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/settings')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                Settings
              </button>
              <button
                onClick={() => router.push('/athlete-home')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="text-center mb-8">
          {/* Profile Photo */}
          <div className="relative inline-block mb-6">
            <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mx-auto flex items-center justify-center overflow-hidden shadow-lg ring-4 ring-white">
              {athleteProfile?.photoURL ? (
                <img
                  src={athleteProfile.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl text-white font-bold">
                  {athleteProfile?.firstName ? athleteProfile.firstName[0].toUpperCase() : '👤'}
                </span>
              )}
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {athleteProfile?.firstName && athleteProfile?.lastName 
              ? `${athleteProfile.firstName} ${athleteProfile.lastName}`
              : 'Your Name'
            }
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            @{athleteProfile?.gofastHandle || 'your_handle'}
          </p>
          
          <button 
            onClick={() => router.push('/athlete-edit-profile')}
            className="bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md hover:shadow-lg"
          >
            Edit Profile
          </button>
        </div>

        {/* Welcome Message for Sparse Profiles */}
        {isProfileSparse && (
          <div className="mb-8 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-3xl">👋</span>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to GoFast!</h3>
                <p className="text-gray-700 mb-3">
                  Complete your profile to connect with other athletes, join crews, and get the most out of GoFast. 
                  Add your bio, location, sport preferences, and more!
                </p>
                <button
                  onClick={() => router.push('/athlete-edit-profile')}
                  className="text-orange-600 hover:text-orange-700 font-medium text-sm underline"
                >
                  Complete your profile →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Info - Beautiful Cards */}
        {filledFields > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bio Card */}
          {athleteProfile?.bio && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Bio</h3>
              </div>
              <p className="text-gray-700 leading-relaxed pl-13">{athleteProfile.bio}</p>
            </div>
          )}

          {/* Location Card */}
          {(athleteProfile?.city || athleteProfile?.state) && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📍</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              </div>
              <p className="text-gray-700 text-lg pl-13">
                {athleteProfile?.city || ''}{athleteProfile?.city && athleteProfile?.state ? ', ' : ''}{athleteProfile?.state || ''}
              </p>
            </div>
          )}

          {/* Primary Sport Card */}
          {athleteProfile?.primarySport && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">🏃</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Primary Sport</h3>
              </div>
              <p className="text-gray-700 text-lg capitalize pl-13">{athleteProfile.primarySport}</p>
            </div>
          )}

          {/* Birthday Card */}
          {athleteProfile?.birthday && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">🎂</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Birthday</h3>
              </div>
              <p className="text-gray-700 text-lg pl-13">
                {new Date(athleteProfile.birthday).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
                {age && ` (Age ${age})`}
              </p>
            </div>
          )}

          {/* Gender Card */}
          {athleteProfile?.gender && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">👤</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Gender</h3>
              </div>
              <p className="text-gray-700 text-lg capitalize pl-13">{athleteProfile.gender}</p>
            </div>
          )}

          {/* Instagram Card */}
          {athleteProfile?.instagram && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📸</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Instagram</h3>
              </div>
              <a 
                href={`https://instagram.com/${athleteProfile.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-700 text-lg pl-13 hover:underline"
              >
                {athleteProfile.instagram}
              </a>
            </div>
          )}

          {/* Phone Number Card */}
          {athleteProfile?.phoneNumber && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Phone</h3>
              </div>
              <p className="text-gray-700 text-lg pl-13">{athleteProfile.phoneNumber}</p>
            </div>
          )}

          {/* Email Card */}
          {athleteProfile?.email && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">✉️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Email</h3>
              </div>
              <p className="text-gray-700 text-lg pl-13">{athleteProfile.email}</p>
            </div>
          )}

          {/* GoFast Handle Card */}
          {athleteProfile?.gofastHandle && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">@</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">GoFast Handle</h3>
              </div>
              <p className="text-gray-700 text-lg pl-13">@{athleteProfile.gofastHandle}</p>
            </div>
          )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <span className="text-5xl mb-4 block">📋</span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Profile is Empty</h3>
              <p className="text-gray-600 mb-6">
                Add information about yourself to help other athletes find and connect with you.
              </p>
              <button
                onClick={() => router.push('/athlete-edit-profile')}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md hover:shadow-lg"
              >
                Add Profile Information
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
