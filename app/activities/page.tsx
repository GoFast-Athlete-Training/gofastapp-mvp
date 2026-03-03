'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';

const METERS_PER_MILE = 1609.34;

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [garminConnected, setGarminConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const model = LocalStorageAPI.getFullHydrationModel();
    const garminFromModel = model?.athlete?.garmin_is_connected;
    const garminFromStorage = localStorage.getItem('garminConnected') === 'true';
    setGarminConnected(garminFromModel || garminFromStorage);

    (async () => {
      try {
        const response = await api.get('/activities');
        const list = response.data?.activities ?? [];
        setActivities(Array.isArray(list) ? list : []);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    })();
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
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {activities.length > 0
              ? 'Your activity stream — synced from Garmin. New runs and workouts appear here automatically.'
              : 'Activities synced from Garmin appear here.'}
          </p>
          {activities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id || activity.sourceActivityId || index}
                  className="bg-white rounded-lg shadow p-5 border border-gray-100 hover:border-orange-200 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    {activity.activityName || activity.activityType || 'Activity'}
                  </div>
                  {activity.startTime && (
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(activity.startTime).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {activity.distance != null && (
                      <span className="text-orange-600 font-medium">
                        {(activity.distance / METERS_PER_MILE).toFixed(2)} mi
                      </span>
                    )}
                    {activity.duration != null && (
                      <span className="text-gray-600">
                        {Math.floor(activity.duration / 60)} min
                      </span>
                    )}
                    {activity.activityType && (
                      <span className="text-gray-500">{activity.activityType}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 py-8">
              {garminConnected
                ? 'No activities yet. New activities will appear here when synced from Garmin.'
                : 'Connect Garmin in Settings to sync activities.'}
              {!garminConnected && (
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="ml-2 text-orange-600 font-medium hover:underline"
                >
                  Go to Settings
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

