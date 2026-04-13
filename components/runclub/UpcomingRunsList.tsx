'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Route, Users } from 'lucide-react';
import api from '@/lib/api';
import { formatRunTime } from '@/utils/formatTime';

export interface UpcomingRun {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  dayOfWeek: string | null;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  totalMiles: number | null;
  pace: string | null;
  rsvpCount: number;
  myRsvpStatus: string | null;
}

interface UpcomingRunsListProps {
  runs: UpcomingRun[];
  onRsvpChange?: (runId: string, status: string | null) => void;
}

function formatRunDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function RunRow({
  run,
  onRsvpChange,
}: {
  run: UpcomingRun;
  onRsvpChange?: (runId: string, status: string | null) => void;
}) {
  const router = useRouter();
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(run.myRsvpStatus);
  const [rsvpCount, setRsvpCount] = useState(run.rsvpCount);
  const [loading, setLoading] = useState(false);

  const isGoing = rsvpStatus === 'going';
  const timeStr = formatRunTime(run);
  const location = [run.meetUpCity, run.meetUpState].filter(Boolean).join(', ');

  const handleRsvp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const newStatus = isGoing ? 'not-going' : 'going';
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status: newStatus });
      const delta = newStatus === 'going' ? 1 : -1;
      setRsvpCount((c) => Math.max(0, c + delta));
      setRsvpStatus(newStatus);
      onRsvpChange?.(run.id, newStatus);
    } catch (err) {
      console.error('RSVP error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => router.push(`/gorun/${run.slug ?? run.id}`)}
      className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
          {run.title}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            {formatRunDate(run.date)}
          </span>
          {timeStr && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              {timeStr}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            {run.meetUpPoint}{location ? `, ${location}` : ''}
          </span>
          {(run.totalMiles || run.pace) && (
            <span className="flex items-center gap-1">
              <Route className="h-3.5 w-3.5 flex-shrink-0" />
              {[run.totalMiles ? `${run.totalMiles} mi` : null, run.pace].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        {rsvpCount > 0 && (
          <span className="flex items-center gap-1 text-sm text-gray-500">
            <Users className="h-3.5 w-3.5" />
            {rsvpCount}
          </span>
        )}
        <button
          onClick={handleRsvp}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
            isGoing
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-600 border border-gray-200'
          }`}
        >
          {loading ? '...' : isGoing ? "I'm going ✓" : "I'm going"}
        </button>
      </div>
    </div>
  );
}

export default function UpcomingRunsList({ runs, onRsvpChange }: UpcomingRunsListProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No upcoming runs scheduled yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} onRsvpChange={onRsvpChange} />
      ))}
    </div>
  );
}
