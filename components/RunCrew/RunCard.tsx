'use client';

import { useRouter } from 'next/navigation';
import { formatRunTime } from '@/utils/formatTime';

interface RunCardProps {
  run: {
    id: string;
    title: string;
    date: string;
    startTimeHour?: number | null;
    startTimeMinute?: number | null;
    startTimePeriod?: string | null;
    startTime?: string | null;
    meetUpPoint: string;
    totalMiles?: number;
    pace?: string;
    rsvps?: Array<{ status: string; athlete: { firstName: string; lastName: string } }>;
  };
  crewId: string;
}

export default function RunCard({ run, crewId }: RunCardProps) {
  const router = useRouter();

  const goingCount = run.rsvps?.filter((r) => r.status === 'going').length || 0;
  const timeStr = formatRunTime(run);

  return (
    <div
      onClick={() => router.push(`/runcrew/${crewId}/runs/${run.id}`)}
      className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{run.title}</h3>
        {goingCount > 0 && (
          <span className="text-sm text-gray-500">{goingCount} going</span>
        )}
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <div>
          {new Date(run.date).toLocaleDateString()} {timeStr && `at ${timeStr}`}
        </div>
        <div>{run.meetUpPoint}</div>
        {run.totalMiles && <div>{run.totalMiles} miles</div>}
        {run.pace && <div>Pace: {run.pace}</div>}
      </div>
    </div>
  );
}

