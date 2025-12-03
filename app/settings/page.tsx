'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gofastbackendv2-fall2025.onrender.com/api';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [connections, setConnections] = useState({
    garmin: false,
    strava: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
    
    // Check Garmin connection status
    if (stored?.id) {
      checkGarminConnection(stored.id);
    } else {
      setLoading(false);
    }
  }, []);

  const checkGarminConnection = async (athleteId: string) => {
    try {
      const response = await fetch(`${API_BASE}/garmin/status?athleteId=${athleteId}`);
      if (response.ok) {
        const data = await response.json();
        setConnections({
          garmin: data.connected || false,
          strava: false, // TODO: Add Strava check
        });
      }
    } catch (error) {
      console.error('Error checking Garmin connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectGarmin = () => {
    router.push('/settings/garmin');
  };

  const disconnectGarmin = async () => {
    if (!athlete?.id) return;
    
    if (confirm('Are you sure you want to disconnect Garmin Connect?')) {
      try {
        // TODO: Implement disconnect endpoint
        // await api.delete(`/garmin/disconnect?athleteId=${athlete.id}`);
        alert('Disconnect functionality coming soon');
      } catch (error) {
        console.error('Error disconnecting Garmin:', error);
        alert('Failed to disconnect Garmin');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and device connections</p>
        </div>

        {/* Device Connections */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Garmin Card - Compact */}
            <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 hover:border-gray-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src="/Garmin_Connect_app_1024x1024-02.png" 
                    alt="Garmin Connect" 
                    className="h-10 w-10 rounded"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">Garmin Connect</h3>
                    <p className="text-sm text-gray-500">Sync activities</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {loading ? (
                    <span className="text-sm text-gray-400">Checking...</span>
                  ) : connections.garmin ? (
                    <>
                      <span className="text-sm text-green-600 font-medium">Connected</span>
                      <button
                        onClick={disconnectGarmin}
                        className="px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={connectGarmin}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Strava Card - Compact */}
            <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 hover:border-gray-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-orange-100 flex items-center justify-center text-2xl">
                    🏃
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Strava</h3>
                    <p className="text-sm text-gray-500">Import activities</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${
                    connections.strava ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {connections.strava ? 'Connected' : 'Not Connected'}
                  </span>
                  {!connections.strava && (
                    <button
                      onClick={() => alert('Strava connection coming soon')}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Section - Compact */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            Connect your devices to automatically sync activities and track your runs. 
            <span className="text-xs text-gray-500 block mt-2">
              Garmin Connect is a trademark of Garmin Ltd. GoFast is not affiliated with Garmin Ltd.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
