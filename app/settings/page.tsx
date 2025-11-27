'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Profile
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Garmin Connection</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {athlete?.garmin_is_connected ? 'Connected' : 'Not Connected'}
                </div>
                <div className="text-sm text-gray-500">
                  {athlete?.garmin_is_connected
                    ? 'Your Garmin account is connected'
                    : 'Connect your Garmin account to sync activities'}
                </div>
              </div>
              <button
                onClick={() => router.push('/settings/garmin')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {athlete?.garmin_is_connected ? 'Manage' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

