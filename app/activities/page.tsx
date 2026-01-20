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
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg p-12 text-center border-2 border-orange-200">
            {garminConnected ? (
              <>
                <div className="mb-6">
                  <div className="text-7xl mb-4">🏃‍♂️</div>
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-full mb-4">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to GoFast?</h2>
                <p className="text-lg text-gray-700 mb-2">
                  Your activities will automatically appear here
                </p>
                <p className="text-base text-gray-600">
                  Start your next run, ride, or workout and watch it sync!
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">Garmin Connected</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="text-7xl mb-4">📊</div>
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full mb-4">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your Garmin</h2>
                <p className="text-lg text-gray-700 mb-2">
                  Sync your activities automatically
                </p>
                <p className="text-base text-gray-600 mb-6">
                  Connect your Garmin account to see all your workouts here
                </p>
                <button
                  onClick={() => router.push('/settings')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition transform hover:scale-105 shadow-lg"
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

