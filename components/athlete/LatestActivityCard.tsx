'use client';

import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import { formatPace } from '@/utils/formatPace';
import { formatDistance } from '@/utils/formatDistance';

interface LatestActivityCardProps {
  latestActivity: any;
}

export default function LatestActivityCard({ latestActivity }: LatestActivityCardProps) {
  const router = useRouter();

  if (!latestActivity) return null;

  return (
    <div
      onClick={() => router.push(`/activities/${latestActivity.id}`)}
      className="bg-white rounded-xl shadow-lg p-4 border border-gray-200 hover:border-orange-300 cursor-pointer transition"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-orange-500" />
          <div>
            <h3 className="font-semibold text-gray-900">Your Latest Run</h3>
            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
              {formatDistance(latestActivity) && (
                <span>{formatDistance(latestActivity)}</span>
              )}
              {formatPace(latestActivity) && <span>· {formatPace(latestActivity)}</span>}
              {latestActivity.startTime && (
                <span>
                  ·{' '}
                  {new Date(latestActivity.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

