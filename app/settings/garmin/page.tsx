'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function GarminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [athlete, setAthlete] = useState<any>(null);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await api.get('/garmin/auth-url');
      if (response.data.success) {
        window.location.href = response.data.authUrl;
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Failed to get Garmin auth URL');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Garmin?')) {
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement disconnect endpoint
      alert('Disconnect functionality coming soon');
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/settings')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back to Settings
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Garmin Connection</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="font-medium">
                {athlete?.garmin_is_connected ? (
                  <span className="text-green-600">Connected</span>
                ) : (
                  <span className="text-gray-600">Not Connected</span>
                )}
              </div>
            </div>

            {athlete?.garmin_is_connected && (
              <div>
                <div className="text-sm text-gray-500">Connected At</div>
                <div className="font-medium">
                  {athlete.garmin_connected_at
                    ? new Date(athlete.garmin_connected_at).toLocaleDateString()
                    : 'Unknown'}
                </div>
              </div>
            )}

            <div className="pt-4">
              {athlete?.garmin_is_connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect Garmin'}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect Garmin'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

