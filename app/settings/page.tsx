'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
// MVP1: Settings page deprecated - redirecting to profile edit
// Profile management is now done via the profile icon in navigation
// All Garmin connection code preserved below for MVP2

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // MVP1: Settings page is redundant - redirect to profile edit
    // Users can manage their profile by clicking the profile icon
    router.replace('/athlete-edit-profile');
  }, [router]);

  return null;
}

/* 
 * ============================================================================
 * MVP1: SETTINGS PAGE DEPRECATED
 * ============================================================================
 * 
 * The settings page has been deprecated for MVP1 because:
 * - Profile management is now accessible via the profile icon in navigation
 * - Settings page was redundant (just showed profile info and linked to edit)
 * 
 * All Garmin connection code is preserved below for MVP2 re-enablement.
 * 
 * ============================================================================
 * ORIGINAL SETTINGS PAGE CODE (PRESERVED FOR MVP2)
 * ============================================================================
 */

/*
import { LocalStorageAPI } from '@/lib/localstorage';
import { useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  // PHASE 1: Garmin connections deprecated
  // const [connections, setConnections] = useState({
  //   garmin: false,
  // });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    setAthlete(stored);
    
    // PHASE 1: Garmin connection check disabled
    // Check Garmin connection status
    // if (stored?.id) {
    //   checkGarminConnection(stored.id);
    // } else {
    //   setLoading(false);
    // }
    setLoading(false);
  }, []);

  const refreshAthleteData = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const firebaseToken = await currentUser.getIdToken();
      
      // READ-ONLY: Read from localStorage only - NO hydration API calls
      // If data needs refresh, user should navigate to welcome page
      console.log('Settings: Data refresh not available - use welcome page to refresh');
    } catch (error) {
      console.error('Error refreshing athlete data:', error);
    }
  };

  // ============================================================================
  // GARMIN CONNECTION CODE - PRESERVED FOR MVP2
  // ============================================================================
  // All Garmin connection functionality is preserved below.
  // To re-enable for MVP2:
  // 1. Uncomment the code below
  // 2. Restore the connections state
  // 3. Add Garmin connection UI to the settings page
  // 4. Uncomment Settings button in TopNav and AthleteHeader
  // ============================================================================

  // PHASE 1: Garmin functions DEPRECATED - Commented out but code preserved
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const checkGarminConnection = async (athleteId: string) => {
    // DEPRECATED: Garmin connections disabled for MVP1
    // Code preserved for future use
    /*
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
    */
    setLoading(false);
  };

  // PHASE 1: Garmin connection function DEPRECATED - Code preserved below
  const connectGarmin = async (e: React.MouseEvent) => {
    // DEPRECATED: Garmin connections disabled for MVP1
    return;
    /*
    e.preventDefault();
    e.stopPropagation();

    console.log('🔵 Connect Garmin button clicked');

    // Check if already connected
    if (athlete?.garmin_user_id) {
      console.log('⚠️ Already connected to Garmin');
      return;
    }

    if (!athlete?.id) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setLoading(true);
    try {
      // Read athleteId from localStorage (athlete state)
      const athleteId = athlete.id;
      console.log('🔵 Athlete ID:', athleteId);

      // CRITICAL: Open popup IMMEDIATELY (synchronously) before any async operations
      // This prevents browser popup blockers from blocking the window
      const popup = window.open('', 'garmin-oauth', 'width=500,height=700,menubar=no,toolbar=no,status=no');

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }

      console.log('✅ Popup opened synchronously (before fetch)');

      // Now fetch authorize URL from backend
      const res = await fetch(`/api/auth/garmin/authorize?athleteId=${athleteId}`, {
        method: 'GET',
        credentials: 'include'
      });

      console.log('🔵 Authorize response status:', res.status);

      if (!res.ok) {
        popup.close();
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Garmin authorize failed');
      }

      const { authUrl } = await res.json();

      if (!authUrl) {
        popup.close();
        console.error('❌ No authUrl returned from authorize endpoint');
        throw new Error('Invalid authorize response');
      }

      console.log('🔵 Loading Garmin URL into popup:', authUrl);

      // Load Garmin page into the already-opened popup
      popup.location.href = authUrl;

      console.log('✅ Popup navigating to Garmin, waiting for OAuth completion...');

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
      // NOTE: Do NOT check origin - Garmin may load intermediate pages (connect.garmin.com)
      // We trust our callback HTML - the only sender is our own server
      const messageHandler = async (event: MessageEvent) => {
        if (!event.data) return;
        
        console.log('🔵 Received message from popup:', event.data);
        
        // Parse data (handle both string and object formats)
        let data;
        try {
          data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
          // If parsing fails, treat as string
          data = event.data;
        }
        
        // Check for success (handle both formats)
        const isSuccess = data === 'garmin-oauth-success' || 
                         (data && data.success === true);
        const isError = data === 'garmin-oauth-error' || 
                       (data && data.success === false);
        
        if (isSuccess) {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          console.log('✅ Garmin OAuth success, refreshing athlete data');
          
          if (athlete?.id) {
            await refreshAthleteData();
            checkGarminConnection(athlete.id);
          }
          window.removeEventListener('message', messageHandler);
        } else if (isError) {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
          const errorMsg = (typeof data === 'object' ? data.error : null) || 'Unknown error';
          console.error('❌ Garmin OAuth error:', errorMsg);
          alert('Failed to connect Garmin: ' + errorMsg);
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (error: any) {
      console.error('❌ Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
    */
  };

  const disconnectGarmin = async () => {
    // DEPRECATED: Garmin connections disabled for MVP1
    // Code preserved for future use
    return;
    /*
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
    */
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // ============================================================================
  // ORIGINAL SETTINGS PAGE UI (PRESERVED FOR MVP2)
  // ============================================================================
  // To restore the settings page UI, uncomment the return statement below
  // and restore the connections state at the top of the component
  // ============================================================================

  /*
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your profile and account</p>
        </div>

        {/* Profile Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {athlete?.photoURL ? (
                  <img
                    src={athlete.photoURL}
                    alt="Profile"
                    className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xl border-2 border-gray-200">
                    {athlete?.firstName ? athlete.firstName[0].toUpperCase() : 'A'}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {athlete?.firstName && athlete?.lastName
                      ? `${athlete.firstName} ${athlete.lastName}`
                      : 'Your Profile'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {athlete?.gofastHandle ? `@${athlete.gofastHandle}` : 'View and edit your profile'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/profile')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  View Profile
                </button>
                <button
                  onClick={() => router.push('/athlete-edit-profile')}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Garmin Connection Section - FOR MVP2 */}
        {/* Uncomment this section when re-enabling Garmin for MVP2
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Connections</h2>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Garmin Connect</h3>
                <p className="text-sm text-gray-500">
                  {connections.garmin ? 'Connected' : 'Connect your Garmin device to sync activities'}
                </p>
              </div>
              {connections.garmin ? (
                <button
                  onClick={disconnectGarmin}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectGarmin}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect Garmin'}
                </button>
              )}
            </div>
          </div>
        </div>
        */}

        {/* Info Section */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>MVP1:</strong> Profile settings only. Activities, events, and device connections are planned for MVP2.
          </p>
        </div>
      </div>
    </div>
  );
  */
}
