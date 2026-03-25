'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import MissingPaceBanner from '@/components/profile/MissingPaceBanner';

export default function ProfilePage() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace('/welcome');
      setLoading(false);
      return;
    }
    api
      .get(`/athlete/${id}`)
      .then((res) => {
        if (res.data?.athlete) setAthleteProfile(res.data.athlete);
      })
      .catch(() => router.replace('/welcome'))
      .finally(() => setLoading(false));

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace('/signup');
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!athleteProfile) {
    return (
      <div className="py-12">
        <p className="text-gray-600">Please sign in</p>
      </div>
    );
  }

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

  const filledFields = [
    athleteProfile?.bio,
    athleteProfile?.instagram,
    athleteProfile?.phoneNumber,
  ].filter(Boolean).length;

  return (
    <div className="max-w-4xl">
      <MissingPaceBanner fiveKPace={athleteProfile.fiveKPace} />

      <div className="text-center mb-8">
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

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          {athleteProfile?.firstName && athleteProfile?.lastName
            ? `${athleteProfile.firstName} ${athleteProfile.lastName}`
            : 'Your Name'}
        </h1>
        <p className="text-lg text-gray-600 mb-2">@{athleteProfile?.gofastHandle || 'your_handle'}</p>
        {athleteProfile?.fiveKPace?.trim() ? (
          <p className="text-sm text-gray-500 mb-4">
            Current 5K pace: <span className="font-semibold text-gray-800">{athleteProfile.fiveKPace.trim()}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/athlete-edit-profile')}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md"
          >
            Edit full profile
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile/training')}
            className="border-2 border-orange-200 text-orange-800 px-6 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
          >
            Training & pace
          </button>
        </div>
      </div>

      {filledFields > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {athleteProfile?.bio && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Bio</h3>
              </div>
              <p className="text-gray-700 leading-relaxed pl-[52px]">{athleteProfile.bio}</p>
            </div>
          )}

          {(athleteProfile?.city || athleteProfile?.state) && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📍</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              </div>
              <p className="text-gray-700 text-lg pl-[52px]">
                {athleteProfile?.city || ''}
                {athleteProfile?.city && athleteProfile?.state ? ', ' : ''}
                {athleteProfile?.state || ''}
              </p>
            </div>
          )}

          {athleteProfile?.primarySport && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">🏃</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Primary Sport</h3>
              </div>
              <p className="text-gray-700 text-lg capitalize pl-[52px]">{athleteProfile.primarySport}</p>
            </div>
          )}

          {athleteProfile?.birthday && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">🎂</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Birthday</h3>
              </div>
              <p className="text-gray-700 text-lg pl-[52px]">
                {new Date(athleteProfile.birthday).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {age ? ` (Age ${age})` : ''}
              </p>
            </div>
          )}

          {athleteProfile?.gender && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">👤</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Gender</h3>
              </div>
              <p className="text-gray-700 text-lg capitalize pl-[52px]">{athleteProfile.gender}</p>
            </div>
          )}

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
                className="text-orange-600 hover:text-orange-700 text-lg pl-[52px] hover:underline"
              >
                {athleteProfile.instagram}
              </a>
            </div>
          )}

          {athleteProfile?.phoneNumber && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Phone</h3>
              </div>
              <p className="text-gray-700 text-lg pl-[52px]">{athleteProfile.phoneNumber}</p>
            </div>
          )}

          {athleteProfile?.email && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">✉️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Email</h3>
              </div>
              <p className="text-gray-700 text-lg pl-[52px]">{athleteProfile.email}</p>
            </div>
          )}

          {athleteProfile?.gofastHandle && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-xl">@</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">GoFast Handle</h3>
              </div>
              <p className="text-gray-700 text-lg pl-[52px]">@{athleteProfile.gofastHandle}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
            <span className="text-5xl mb-4 block">📋</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Add more to your profile</h3>
            <p className="text-gray-600 mb-6">
              Bio, Instagram, and phone help others recognize you. Use Findability in the sidebar or
              edit everything in one place.
            </p>
            <button
              type="button"
              onClick={() => router.push('/athlete-edit-profile')}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md"
            >
              Edit profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
