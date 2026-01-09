'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import { useEffect, useState } from 'react';

/**
 * Minimal Settings Page - Phase 1
 * 
 * Profile settings only - Garmin/device connections deprecated for MVP1
 */
export default function MinimalSettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your account</p>
          </div>
          <button
            onClick={() => router.push('/my-runcrews')}
            className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            ← My RunCrews
          </button>
        </div>

        {/* Profile Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 hover:border-gray-300 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {athlete?.photoURL ? (
                  <img
                    src={athlete.photoURL}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {athlete?.firstName ? athlete.firstName[0].toUpperCase() : 'A'}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {athlete?.firstName && athlete?.lastName
                      ? `${athlete.firstName} ${athlete.lastName}`
                      : 'Your Profile'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {athlete?.gofastHandle ? `@${athlete.gofastHandle}` : 'View and edit your profile'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
              >
                View Profile
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            Profile settings and device connections are available in the full settings page.
          </p>
        </div>
      </div>
    </div>
  );
}

