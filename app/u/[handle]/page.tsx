'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, User } from 'lucide-react';

type PublicAthlete = {
  gofastHandle: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  showTrainingSummary: boolean;
  showUpcomingWorkouts: boolean;
};

type TrainingSummary = {
  planName: string;
  startDate: string;
  totalWeeks: number;
  raceName: string | null;
};

type UpcomingWorkout = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
};

type UpcomingRun = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  gofastCity: string;
  meetUpPoint: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workoutId: string | null;
  gorunPath: string;
};

function formatRunWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWorkoutDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date TBD';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PublicAthletePage() {
  const params = useParams();
  const handle = (params.handle as string) || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<PublicAthlete | null>(null);
  const [trainingSummary, setTrainingSummary] = useState<TrainingSummary | null>(null);
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<UpcomingWorkout[]>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<UpcomingRun[]>([]);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setError('Not found');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/athlete/public/${encodeURIComponent(handle)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Not found');
          setAthlete(null);
          return;
        }
        setAthlete(data.athlete);
        setTrainingSummary(data.trainingSummary ?? null);
        setUpcomingWorkouts(data.upcomingWorkouts ?? []);
        setUpcomingRuns(data.upcomingRuns ?? []);
      } catch {
        if (!cancelled) setError('Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <User className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-600 text-center">This profile is not available.</p>
        <Link href="/welcome" className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-medium">
          Go to GoFast
        </Link>
      </div>
    );
  }

  const displayName =
    [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || `@${athlete.gofastHandle}`;
  const location =
    athlete.city && athlete.state
      ? `${athlete.city}, ${athlete.state}`
      : athlete.city || athlete.state || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            {athlete.photoURL ? (
              <Image
                src={athlete.photoURL}
                alt=""
                width={96}
                height={96}
                className="rounded-full object-cover w-24 h-24 border border-slate-200"
                unoptimized
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-12 h-12 text-slate-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{displayName}</h1>
            {athlete.gofastHandle && (
              <p className="text-slate-500 font-medium">@{athlete.gofastHandle}</p>
            )}
            {location && (
              <p className="text-slate-600 text-sm mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 shrink-0" />
                {location}
              </p>
            )}
            {athlete.primarySport && (
              <p className="text-slate-600 text-sm mt-0.5">{athlete.primarySport}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {athlete.bio && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bio</h2>
            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{athlete.bio}</p>
          </section>
        )}

        {athlete.showTrainingSummary && trainingSummary && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">My training</h2>
            <p className="text-slate-800 font-medium">{trainingSummary.planName}</p>
            <p className="text-slate-600 text-sm mt-1">
              {trainingSummary.totalWeeks} weeks · started{' '}
              {new Date(trainingSummary.startDate).toLocaleDateString()}
            </p>
            {trainingSummary.raceName && (
              <p className="text-slate-600 text-sm mt-2">Goal race: {trainingSummary.raceName}</p>
            )}
          </section>
        )}

        {athlete.showUpcomingWorkouts && upcomingWorkouts.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Workouts I&apos;m doing</h2>
            <ul className="space-y-3">
              {upcomingWorkouts.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 last:border-0 pb-3 last:pb-0"
                >
                  <span className="text-slate-800 font-medium">{w.title}</span>
                  <span className="text-slate-500 text-sm">
                    {formatWorkoutDate(w.date)} · {w.workoutType}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Join me</h2>
          <p className="text-slate-600 text-sm mb-4">RSVP on the run page — same flow as city runs.</p>
          {upcomingRuns.length === 0 ? (
            <p className="text-slate-500 text-sm">No upcoming public runs listed yet.</p>
          ) : (
            <ul className="space-y-4">
              {upcomingRuns.map((r) => (
                <li
                  key={r.id}
                  className="border border-slate-100 rounded-lg p-4 bg-slate-50/80 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{r.title}</span>
                  </div>
                  <p className="text-slate-600 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {formatRunWhen(r.date)}
                  </p>
                  <p className="text-slate-600 text-sm flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {r.meetUpPoint}
                      {r.gofastCity ? ` · ${r.gofastCity}` : ''}
                    </span>
                  </p>
                  <Link
                    href={r.gorunPath}
                    className="inline-flex items-center justify-center mt-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors w-full sm:w-auto"
                  >
                    View run & RSVP
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
