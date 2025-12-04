'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [connections, setConnections] = useState({
    garmin: false,
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

  const refreshAthleteData = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const firebaseToken = await currentUser.getIdToken();
      
      // Hydrate athlete to get fresh data including Garmin connection status
      const response = await fetch(`${API_BASE}/athlete/hydrate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firebaseToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.athlete) {
          // Update localStorage with fresh athlete data
          LocalStorageAPI.setAthlete(data.athlete);
          setAthlete(data.athlete);
          
          // Update connection status from fresh data
          setConnections({
            garmin: data.athlete.garmin_is_connected || false,
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing athlete data:', error);
    }
  };

  const checkGarminConnection = async (athleteId: string) => {
    try {
      const response = await fetch(`${API_BASE}/garmin/status?athleteId=${athleteId}`);
      if (response.ok) {
        const data = await response.json();
        setConnections({
          garmin: data.connected || false,
        });
      }
    } catch (error) {
      console.error('Error checking Garmin connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectGarmin = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('🔵 Connect Garmin button clicked');

    setLoading(true);
    try {
      // Get Firebase token for authorization
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to connect Garmin');
        setLoading(false);
        return;
      }
      const firebaseToken = await currentUser.getIdToken();

      // Fetch authorize endpoint to get OAuth URL
      const res = await fetch('/api/auth/garmin/authorize?popup=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        },
        credentials: 'include'
      });

      const data = await res.json();
      const authUrl = data.url;

      if (!authUrl) {
        throw new Error(data.error || 'No auth URL received from server');
      }

      console.log('🔵 Received auth URL:', authUrl);

      // OPEN POPUP (not fetch!) - let window.open() navigate to it
      const popup = window.open(authUrl, 'garmin-oauth', 'width=600,height=800');

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }

      console.log('✅ Popup opened, waiting for OAuth completion...');

      // Listen for popup to close or send message
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setLoading(false);
          console.log('🔵 Popup closed, checking connection status');
          if (athlete?.id) {
            refreshAthleteData().then(() => {
              checkGarminConnection(athlete.id);
            });
          }
        }
      }, 500);

      // Listen for postMessage from callback
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          console.warn('⚠️ Ignoring message from different origin:', event.origin);
          return;
        }
        
        console.log('🔵 Received message from popup:', event.data);
        
        if (event.data === 'garmin-oauth-success') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          console.log('✅ Garmin OAuth success, refreshing athlete data');
          
          if (athlete?.id) {
            await refreshAthleteData();
            checkGarminConnection(athlete.id);
          }
          window.removeEventListener('message', messageHandler);
        } else if (event.data === 'garmin-oauth-error') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          console.error('❌ Garmin OAuth error');
          alert('Failed to connect Garmin. Please try again.');
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (error: any) {
      console.error('❌ Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your account and device connections</p>
          </div>
          <button
            onClick={() => router.push('/athlete-home')}
            className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            ← Back to Home
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

        {/* Device Connections */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Connections</h2>
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
