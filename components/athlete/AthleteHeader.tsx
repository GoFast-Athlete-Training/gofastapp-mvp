'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
// MVP1: Settings deprecated
// import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AthleteHeader() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const athlete = LocalStorageAPI.getAthleteProfile();
      setAthleteProfile(athlete);
    }
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
    <header className="bg-white border-b border-gray-200 relative z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="GoFast" className="w-8 h-8 rounded-full" />
          <span className="text-xl font-bold text-gray-900">GoFast</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            {athleteProfile?.photoURL ? (
              <img
                src={athleteProfile.photoURL}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {athleteProfile?.firstName ? athleteProfile.firstName[0].toUpperCase() : 'A'}
              </span>
            )}
          </button>
          {/* MVP1: Settings deprecated - Profile management via profile icon */}
          {/* Settings Button - COMMENTED OUT FOR MVP1
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Settings button clicked');
              router.push('/settings');
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition relative z-10 cursor-pointer"
            type="button"
            style={{ pointerEvents: 'auto' }}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </button>
          */}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

