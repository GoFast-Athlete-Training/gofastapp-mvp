'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [garminConnected, setGarminConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check Garmin connection status
    const model = LocalStorageAPI.getFullHydrationModel();
    const garminFromModel = model?.athlete?.garmin_is_connected;
    const garminFromStorage = localStorage.getItem('garminConnected') === 'true';
    const isConnected = garminFromModel || garminFromStorage;
    setGarminConnected(isConnected);

    // Get activities from localStorage (set during hydration)
    const weeklyActivities = model?.weeklyActivities || [];
    setActivities(weeklyActivities);
    setLoading(false);
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to sync activities');
        setSyncing(false);
        return;
      }

      const firebaseToken = await currentUser.getIdToken();
      const response = await api.post('/garmin/sync', {}, {
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        }
      });

      if (response.data?.success) {
        alert(`Synced ${response.data.summary?.fetched || 0} activities. Please refresh the page.`);
        // Refresh page to show updated activities
        window.location.reload();
      } else {
        alert('Sync failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      alert('Failed to sync activities: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
          {garminConnected && (
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
        
        {activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity, index) => (
              <div key={activity.id || index} className="bg-white rounded-lg shadow p-6">
                <div className="font-medium">{activity.activityName || 'Activity'}</div>
                <div className="text-sm text-gray-600">
                  {activity.activityType}
                </div>
                {activity.distance && (
                  <div className="text-sm text-gray-500">
                    {(activity.distance / 1609.34).toFixed(2)} miles
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            {garminConnected ? (
              <>
                <p className="text-gray-500 text-lg mb-2">No activities synced yet</p>
                <p className="text-sm text-gray-400 mb-4">
                  Click "Sync Now" to pull your activities from Garmin
                </p>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-lg mb-2">No activities yet</p>
                <p className="text-sm text-gray-400 mb-4">
                  Connect your Garmin account to sync activities
                </p>
                <button
                  onClick={() => router.push('/settings')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Connect Garmin
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

