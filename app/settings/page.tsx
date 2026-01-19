'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and integrations</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
            <p className="text-gray-600 mb-4">Update your profile information, photo, and bio.</p>
            <Link
              href="/athlete-edit-profile"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Edit Profile
            </Link>
          </div>

          {/* Integrations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Integrations</h2>
            <p className="text-gray-600 mb-4">Connect your fitness apps and devices.</p>
            
            {/* Garmin Integration */}
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Garmin</h3>
                      <p className="text-sm text-gray-600">
                        {athlete?.garmin_is_connected ? (
                          <span className="text-green-600">Connected</span>
                        ) : (
                          <span className="text-gray-500">Not connected</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {athlete?.garmin_is_connected && athlete?.garmin_connected_at && (
                    <p className="text-xs text-gray-500 ml-13">
                      Connected {new Date(athlete.garmin_connected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Link
                  href="/settings/garmin"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"
                >
                  {athlete?.garmin_is_connected ? 'Manage' : 'Connect'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
