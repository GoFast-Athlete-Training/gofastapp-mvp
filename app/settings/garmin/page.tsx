'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    if (!athlete?.id) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setLoading(true);
    try {
      // Get Firebase token
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to connect Garmin');
        setLoading(false);
        return;
      }
      const firebaseToken = await currentUser.getIdToken();
      
      // Call authorize endpoint to get auth URL (with popup flag)
      const response = await fetch('/api/auth/garmin/authorize?popup=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get auth URL');
      }

      const data = await response.json();
      if (!data.success || !data.authUrl) {
        throw new Error('Invalid response from server');
      }

      // Open popup window
      const popup = window.open(
        data.authUrl,
        'garmin-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }

      // Listen for popup to close or send message
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setLoading(false);
          // Refresh athlete data to check connection status
          const stored = LocalStorageAPI.getAthlete();
          setAthlete(stored);
        }
      }, 500);

      // Listen for postMessage from callback
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'GARMIN_OAUTH_SUCCESS') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          // Refresh athlete data
          const stored = LocalStorageAPI.getAthlete();
          setAthlete(stored);
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'GARMIN_OAUTH_ERROR') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          alert('Failed to connect Garmin: ' + (event.data.error || 'Unknown error'));
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (error: any) {
      console.error('Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
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
        
        <div className="flex items-center gap-4 mb-8">
          <Image 
            src="/Garmin_Connect_app_1024x1024-02.png" 
            alt="Garmin Connect" 
            width={48}
            height={48}
            className="rounded-lg"
          />
          <h1 className="text-3xl font-bold text-gray-900">Garmin Connect</h1>
        </div>
        
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

