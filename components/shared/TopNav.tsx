'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { Home, Settings, Calendar } from 'lucide-react';

interface TopNavProps {
  showBack?: boolean;
  backUrl?: string;
  backLabel?: string;
}

export default function TopNav({ showBack = false, backUrl, backLabel = 'Back' }: TopNavProps) {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) return;
    api
      .get(`/athlete/${id}`)
      .then((res) => {
        if (res.data?.athlete) setAthleteProfile(res.data.athlete);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      LocalStorageAPI.clearAll();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <Link href="/my-runcrews" className="flex items-center gap-3">
              <img src="/logo.jpg" alt="GoFast" className="w-8 h-8 rounded-full" />
              <span className="text-xl font-bold text-gray-900 hidden sm:inline">GoFast</span>
            </Link>
            {showBack && backUrl && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`🔵 TopNav: Navigating to ${backUrl}`);
                  router.push(backUrl);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition ml-4 cursor-pointer"
                type="button"
              >
                ← {backLabel}
              </button>
            )}
          </div>

          {/* Right: Home, Workouts, Settings, Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Home Icon */}
            <Link
              href="/athlete-home"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              title="Home"
            >
              <Home className="h-5 w-5" />
            </Link>

            {/* Workouts Icon */}
            <Link
              href="/workouts"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              title="Workouts"
            >
              <Calendar className="h-5 w-5" />
            </Link>

            {/* Settings Icon */}
            <Link
              href="/settings"
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>

            {/* Profile Picture Button - Links to Edit Profile */}
            <Link
              href="/athlete-edit-profile"
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 hover:text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition"
              title="Edit Profile"
            >
              {athleteProfile?.photoURL ? (
                <img
                  src={athleteProfile.photoURL}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-gray-200">
                  {athleteProfile?.firstName ? athleteProfile.firstName[0].toUpperCase() : 'A'}
                </div>
              )}
              <span className="hidden sm:inline text-sm">
                {athleteProfile?.firstName || 'Profile'}
              </span>
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition"
            >
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

