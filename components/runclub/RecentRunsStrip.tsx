'use client';

import { useRouter } from 'next/navigation';
import { Camera, CheckCircle, MessageSquare } from 'lucide-react';

export interface RecentRun {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  dayOfWeek: string | null;
  meetUpPoint: string;
  checkinCount: number;
  photos: string[];
  topShouts: string[];
  attendees: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  }>;
}

function formatPastDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function AttendeeBubbles({
  attendees,
}: {
  attendees: RecentRun['attendees'];
}) {
  const visible = attendees.slice(0, 5);
  const overflow = attendees.length - visible.length;

  return (
    <div className="flex -space-x-2">
      {visible.map((a) =>
        a.photoURL ? (
          <img
            key={a.id}
            src={a.photoURL}
            alt={`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()}
            className="w-7 h-7 rounded-full border-2 border-white object-cover"
          />
        ) : (
          <div
            key={a.id}
            className="w-7 h-7 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600"
          >
            {(a.firstName?.[0] ?? '?').toUpperCase()}
          </div>
        )
      )}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500">
          +{overflow}
        </div>
      )}
    </div>
  );
}

function RecentRunCard({ run }: { run: RecentRun }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/gorun/${run.slug ?? run.id}`)}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
    >
      {/* Photo strip */}
      {run.photos.length > 0 && (
        <div className="flex gap-1 h-28 overflow-hidden bg-gray-100">
          {run.photos.slice(0, 3).map((photo, i) => (
            <div
              key={i}
              className="flex-1 overflow-hidden"
              style={{ minWidth: 0 }}
            >
              <img
                src={photo}
                alt={`Run photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-gray-900 text-sm leading-tight">
              {run.title}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatPastDate(run.date)}</div>
          </div>
          {run.checkinCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              {run.checkinCount} {run.checkinCount === 1 ? 'runner' : 'runners'}
            </div>
          )}
        </div>

        {run.attendees.length > 0 && (
          <div className="mb-3">
            <AttendeeBubbles attendees={run.attendees} />
          </div>
        )}

        {run.topShouts.length > 0 && (
          <div className="space-y-1">
            {run.topShouts.map((shout, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2"
              >
                <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                <span className="line-clamp-2">{shout}</span>
              </div>
            ))}
          </div>
        )}

        {run.checkinCount === 0 && run.photos.length === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Camera className="h-3.5 w-3.5" />
            No check-ins yet
          </div>
        )}
      </div>
    </div>
  );
}

interface RecentRunsStripProps {
  runs: RecentRun[];
}

export default function RecentRunsStrip({ runs }: RecentRunsStripProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No past runs yet — check back after your first run.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {runs.map((run) => (
        <RecentRunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
