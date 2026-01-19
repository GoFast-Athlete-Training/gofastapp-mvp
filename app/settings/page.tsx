'use client';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [connectingGarmin, setConnectingGarmin] = useState(false);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
  }, []);

  // Direct Garmin OAuth flow (like gofastfrontend-mvp1)
  const connectGarmin = async () => {
    if (!athlete?.id) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setConnectingGarmin(true);
    try {
      // Get Firebase token
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to connect Garmin');
        setConnectingGarmin(false);
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

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'garmin-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setConnectingGarmin(false);
        return;
      }

      // Listen for popup to close
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setConnectingGarmin(false);
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
          setConnectingGarmin(false);
          // Refresh athlete data
          const stored = LocalStorageAPI.getAthlete();
          setAthlete(stored);
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'GARMIN_OAUTH_ERROR') {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          alert('Failed to connect Garmin: ' + (event.data.error || 'Unknown error'));
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (error: any) {
      console.error('Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
      setConnectingGarmin(false);
    }
  };

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
            <div className="border border-gray-200 rounded-lg p-4 mb-4 hover:border-gray-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Image 
                    src="/Garmin_Connect_app_1024x1024-02.png" 
                    alt="Garmin Connect" 
                    width={40}
                    height={40}
                    className="rounded"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Garmin Connect</h3>
                    <p className="text-sm text-gray-600">
                      {athlete?.garmin_is_connected ? (
                        <span className="text-green-600">Connected</span>
                      ) : (
                        <span className="text-gray-500">Sync activities</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {athlete?.garmin_is_connected ? (
                    <>
                      <span className="text-sm text-green-600 font-medium">Connected</span>
                      <Link
                        href="/settings/garmin"
                        className="px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      >
                        Manage
                      </Link>
                    </>
                  ) : (
                    <button
                      onClick={connectGarmin}
                      disabled={connectingGarmin}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50"
                    >
                      {connectingGarmin ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
