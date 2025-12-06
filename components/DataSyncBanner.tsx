'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

/**
 * DataSyncBanner - Detects database resets and prompts users to re-sync
 * Shows when localStorage has data but database doesn't (indicating a reset)
 */
export default function DataSyncBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkDataSync = async () => {
      // Check if user has dismissed this banner
      const dismissedKey = localStorage.getItem('dataSyncBannerDismissed');
      if (dismissedKey === 'true') {
        setDismissed(true);
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        try {
          // Check if localStorage has athlete data
          const storedAthlete = LocalStorageAPI.getAthlete();
          if (!storedAthlete) return;

          // Try to verify athlete exists in database
          const token = await user.getIdToken();
          try {
            const response = await api.post('/athlete/hydrate', {}, {
              headers: { Authorization: `Bearer ${token}` }
            });

            // If hydration succeeds, data is in sync - hide banner
            if (response.data.success && response.data.athlete) {
              LocalStorageAPI.setAthlete(response.data.athlete);
              setShowBanner(false);
              return;
            }
          } catch (hydrateErr: any) {
            // If hydration returns 404, athlete doesn't exist in DB
            // Check if localStorage has meaningful data
            const hasData = storedAthlete && (
              storedAthlete.firstName || 
              storedAthlete.lastName || 
              storedAthlete.email ||
              storedAthlete.gofastHandle
            );
            
            if (hasData && (hydrateErr.response?.status === 404 || hydrateErr.response?.data?.error?.includes('not found'))) {
              // localStorage has data but DB doesn't - database reset detected
              setShowBanner(true);
              return;
            }
          }
          
          // If we get here, either no localStorage data or sync is fine
          setShowBanner(false);
        } catch (err: any) {
          console.error('Error checking data sync:', err);
          // Don't show banner on general errors
          setShowBanner(false);
        }
      });

      return () => unsubscribe();
    };

    checkDataSync();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('Please sign in to sync your data.');
        setSyncing(false);
        return;
      }

      const token = await user.getIdToken();
      
      // Create/re-create athlete (upsert will handle existing or new)
      const createResponse = await api.post('/athlete/create', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (createResponse.data.success) {
        // Re-hydrate to get full data with all relations
        const hydrateResponse = await api.post('/athlete/hydrate', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (hydrateResponse.data.success && hydrateResponse.data.athlete) {
          LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
          setShowBanner(false);
          setDismissed(false);
          localStorage.removeItem('dataSyncBannerDismissed');
          
          // Show success message
          alert('✅ Your data has been successfully synced!');
          
          // Refresh the page to show updated data
          window.location.reload();
        } else {
          throw new Error('Failed to hydrate after sync');
        }
      } else {
        throw new Error(createResponse.data.error || 'Failed to sync');
      }
    } catch (err: any) {
      console.error('Error syncing data:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      alert(`Failed to sync data: ${errorMsg}. Please try again or contact support.`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('dataSyncBannerDismissed', 'true');
  };

  if (dismissed || !showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Database Reset Detected</p>
              <p className="text-sm text-orange-100">
                We detected a database reset. Your profile data is safe in your browser, but please re-sync to restore it to your account.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Re-sync Data</span>
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-orange-100 p-2 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

