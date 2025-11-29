'use client';

import { useRouter } from 'next/navigation';

interface WeeklyStatsProps {
  weeklyTotals: any;
}

export default function WeeklyStats({ weeklyTotals }: WeeklyStatsProps) {
  const router = useRouter();

  if (!weeklyTotals) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Week</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">
            {(() => {
              const miles = weeklyTotals.totalDistanceMiles;
              const numMiles =
                typeof miles === 'number'
                  ? miles
                  : typeof miles === 'string'
                    ? parseFloat(miles)
                    : 0;
              return isNaN(numMiles) ? '0' : numMiles.toFixed(1);
            })()}
          </p>
          <p className="text-sm text-gray-600">Miles</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">
            {weeklyTotals.activityCount || 0}
          </p>
          <p className="text-sm text-gray-600">Activities</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">
            {Math.round(weeklyTotals.totalCalories || 0)}
          </p>
          <p className="text-sm text-gray-600">Calories</p>
        </div>
      </div>
      <button
        onClick={() => router.push('/activities')}
        className="mt-4 w-full text-sm text-orange-600 hover:text-orange-700 font-semibold hover:underline"
      >
        View All Activities →
      </button>
    </div>
  );
}

