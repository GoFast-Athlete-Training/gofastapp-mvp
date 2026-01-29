'use client';

import { useRouter } from 'next/navigation';
import { formatRunTime } from '@/utils/formatTime';

interface CityRunCardProps {
  run: {
    id: string;
    title: string;
    date: string;
    startTimeHour?: number | null;
    startTimeMinute?: number | null;
    startTimePeriod?: string | null;
    startTime?: string | null;
    meetUpPoint: string;
    meetUpAddress?: string | null;
    totalMiles?: number | null;
    pace?: string | null;
    runClub?: {
      id: string;
      slug: string;
      name: string;
      logoUrl?: string | null;
    } | null;
  };
  citySlug?: string; // Optional: for URL generation
}

export default function CityRunCard({ run, citySlug }: CityRunCardProps) {
  const router = useRouter();

  const timeStr = formatRunTime(run);
  
  // Generate URL for the run detail page
  // Format: /runs/{runId} or /{citySlug}/runs/{runId}
  const runUrl = citySlug 
    ? `/${citySlug}/runs/${run.id}`
    : `/runs/${run.id}`;

  return (
    <div
      onClick={() => router.push(runUrl)}
      className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{run.title}</h3>
          {/* Optionally show runclub */}
          {run.runClub && (
            <div className="flex items-center gap-2 mt-1">
              {run.runClub.logoUrl && (
                <img
                  src={run.runClub.logoUrl}
                  alt={run.runClub.name}
                  className="w-5 h-5 rounded object-cover"
                />
              )}
              <span className="text-xs text-gray-500">{run.runClub.name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <div>
          {new Date(run.date).toLocaleDateString()} {timeStr && `at ${timeStr}`}
        </div>
        <div>{run.meetUpPoint}</div>
        {run.meetUpAddress && (
          <div className="text-xs text-gray-500">{run.meetUpAddress}</div>
        )}
        {run.totalMiles && <div>{run.totalMiles} miles</div>}
        {run.pace && <div>Pace: {run.pace}</div>}
      </div>
      {/* URL display for quick copy/reference */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <a
          href={runUrl}
          onClick={(e) => {
            e.stopPropagation();
            // Allow right-click to copy link
          }}
          className="text-xs text-blue-600 hover:text-blue-800 break-all"
          title="Click to copy URL"
        >
          {typeof window !== 'undefined' ? window.location.origin : ''}{runUrl}
        </a>
      </div>
    </div>
  );
}
