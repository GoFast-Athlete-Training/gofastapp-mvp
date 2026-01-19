'use client';


import { useEffect, useState } from 'react';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get activities from localStorage (set during hydration)
    const athlete = LocalStorageAPI.getAthlete();
    if (athlete) {
      // Activities would be stored during hydration
      // For now, show empty state
      setActivities([]);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Activities</h1>
        
        {activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-white rounded-lg shadow p-6">
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
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No activities yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Connect your Garmin account to sync activities
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

