'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Route } from 'lucide-react';
import api from '@/lib/api';
import { formatRunTime } from '@/utils/formatTime';
import { formatCalendarDate } from '@/lib/calendar-date';

export type GoingAthlete = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
};

export type NextRunHeroRun = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
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
  goingAthletes: GoingAthlete[];
};

function formatRunDate(dateStr: string): string {
  return formatCalendarDate(dateStr, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function GoingFaces({ athletes, totalCount }: { athletes: GoingAthlete[]; totalCount: number }) {
  const visible = athletes.slice(0, 6);
  const overflow = Math.max(0, totalCount - visible.length);

  if (totalCount === 0) {
    return (
      <p className="text-sm text-gray-500">Be the first to say you&apos;re going.</p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {visible.map((a) =>
          a.photoURL ? (
            <img
              key={a.id}
              src={a.photoURL}
              alt={`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()}
              className="h-9 w-9 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div
              key={a.id}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-orange-100 text-xs font-semibold text-orange-700"
            >
              {(a.firstName?.[0] ?? '?').toUpperCase()}
            </div>
          )
        )}
        {overflow > 0 && (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-semibold text-gray-600">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-600">
        {totalCount} going
      </span>
    </div>
  );
}

type ClubNextRunHeroProps = {
  run: NextRunHeroRun | null;
  onRsvpChange?: () => void;
};

export default function ClubNextRunHero({ run, onRsvpChange }: ClubNextRunHeroProps) {
  const router = useRouter();
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(run?.myRsvpStatus ?? null);
  const [rsvpCount, setRsvpCount] = useState(run?.rsvpCount ?? 0);
  const [goingAthletes, setGoingAthletes] = useState<GoingAthlete[]>(run?.goingAthletes ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!run) return;
    setRsvpStatus(run.myRsvpStatus);
    setRsvpCount(run.rsvpCount);
    setGoingAthletes(run.goingAthletes);
  }, [run]);

  if (!run) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
        <p className="text-gray-500 text-sm">No upcoming runs on the calendar yet.</p>
      </section>
    );
  }

  const isGoing = rsvpStatus === 'going';
  const timeStr = formatRunTime(run);
  const location = [run.meetUpCity, run.meetUpState].filter(Boolean).join(', ');

  const handleRsvp = async () => {
    if (loading) return;
    setLoading(true);
    const newStatus = isGoing ? 'not-going' : 'going';
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status: newStatus });
      setRsvpCount((c) => Math.max(0, c + (newStatus === 'going' ? 1 : -1)));
      setRsvpStatus(newStatus);
      onRsvpChange?.();
    } catch (err) {
      console.error('RSVP error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openRun = () => router.push(`/gorun/${run.slug ?? run.id}`);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-5 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-100">Next run</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">{run.title}</h2>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-orange-50">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            {formatRunDate(run.date)}
          </span>
          {timeStr ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" />
              {timeStr}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">
              {run.meetUpPoint}
              {location ? ` · ${location}` : ''}
            </span>
          </span>
          {(run.totalMiles || run.pace) && (
            <span className="inline-flex items-center gap-1.5">
              <Route className="h-4 w-4 shrink-0 text-gray-400" />
              {[run.totalMiles ? `${run.totalMiles} mi` : null, run.pace].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <GoingFaces athletes={goingAthletes} totalCount={rsvpCount} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void handleRsvp()}
            disabled={loading}
            className={`inline-flex flex-1 justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-50 sm:flex-none sm:min-w-[160px] ${
              isGoing
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {loading ? 'Saving…' : isGoing ? "I'm going ✓" : "I'm going"}
          </button>
          <button
            type="button"
            onClick={openRun}
            className="inline-flex flex-1 justify-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
          >
            Run details
          </button>
        </div>
      </div>
    </section>
  );
}
