'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import api from '@/lib/api';
import { Activity, Zap } from 'lucide-react';

const METERS_PER_MILE = 1609.34;

function getStartOfThisWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - now.getDay());
  return start;
}

function getEndOfThisWeek() {
  const start = getStartOfThisWeek();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

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

  const weekStats = useMemo(() => {
    const start = getStartOfThisWeek();
    const end = getEndOfThisWeek();
    const thisWeek = activities.filter((a) => {
      const t = a.startTime ? new Date(a.startTime) : null;
      return t && t >= start && t < end;
    });
    const miles = thisWeek.reduce((sum, a) => sum + (a.distance ?? 0) / METERS_PER_MILE, 0);
    const minutes = thisWeek.reduce((sum, a) => sum + (a.duration ?? 0) / 60, 0);
    const calories = thisWeek.reduce((sum, a) => sum + (a.calories ?? 0), 0);
    return {
      miles,
      activities: thisWeek.length,
      minutes: Math.round(minutes),
      calories: Math.round(calories),
    };
  }, [activities]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Activities</h1>

        {/* Summary card: Your week */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-orange-100">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">This week</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {weekStats.miles.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500">Miles</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {weekStats.activities}
              </p>
              <p className="text-sm text-gray-500">Activities</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {weekStats.minutes}
              </p>
              <p className="text-sm text-gray-500">Minutes</p>
            </div>
          </div>
        </div>

        {/* Activity list */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent activity</h2>
          {activities.length > 0 ? (
            <ul className="space-y-3">
              {activities.map((activity, index) => (
                <li
                  key={activity.id || activity.sourceActivityId || index}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-orange-200/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {activity.activityName || activity.activityType || 'Activity'}
                      </p>
                      {activity.startTime ? (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(activity.startTime).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {activity.distance != null && (
                          <span className="text-orange-600 font-semibold">
                            {(activity.distance / METERS_PER_MILE).toFixed(2)} mi
                          </span>
                        )}
                        {activity.duration != null && (
                          <span className="text-gray-600">
                            {Math.floor(activity.duration / 60)} min
                          </span>
                        )}
                        {activity.activityType && (
                          <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                            {activity.activityType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100">
                      <Activity className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500">
                {garminConnected
                  ? 'No activities yet. New activities will appear here when synced from Garmin.'
                  : 'Connect Garmin in Settings to sync activities.'}
              </p>
              {!garminConnected && (
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="mt-3 text-orange-600 font-medium hover:underline"
                >
                  Go to Settings
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

