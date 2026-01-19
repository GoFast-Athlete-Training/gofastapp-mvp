'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [garminConnected, setGarminConnected] = useState(false);

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
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
                <p className="text-gray-500 text-lg mb-2">No activities yet</p>
                <p className="text-sm text-gray-400">
                  Start your next activity and it will show up here
                </p>
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

