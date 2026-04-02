"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, User, ListTree } from "lucide-react";

type Segment = {
  id: string;
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount?: number | null;
  notes?: string | null;
};

type Payload = {
  success: boolean;
  workout: {
    id: string;
    title: string;
    workoutType: string;
    description: string | null;
    estimatedDistanceInMeters: number | null;
    slug: string | null;
    segments: Segment[];
  };
  athlete: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
    city: string | null;
    state: string | null;
    primarySport: string | null;
    bio: string | null;
  } | null;
  cityRun: {
    id: string;
    slug: string | null;
    title: string;
    date: string;
    gofastCity: string;
    meetUpPoint: string;
    meetUpStreetAddress: string | null;
    meetUpCity: string | null;
    meetUpState: string | null;
    startTimeHour: number | null;
    startTimeMinute: number | null;
    startTimePeriod: string | null;
    gorunPath: string;
  } | null;
};

function formatRunWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MyTrainingRunPublicPage() {
  const params = useParams();
  const slug = (params.slug as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Not found");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/training/public/${encodeURIComponent(slug)}`);
        const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Not found");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data?.athlete || !data.workout) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <User className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-600 text-center">This training page is not available.</p>
        <Link href="/welcome" className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-medium">
          Go to GoFast
        </Link>
      </div>
    );
  }

  const { athlete, workout, cityRun } = data;
  const displayName =
    [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") ||
    (athlete.gofastHandle ? `@${athlete.gofastHandle}` : "Athlete");
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
            {athlete.gofastHandle ? (
              <p className="text-slate-500 font-medium">@{athlete.gofastHandle}</p>
            ) : null}
            {location ? (
              <p className="text-slate-600 text-sm mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 shrink-0" />
                {location}
              </p>
            ) : null}
            {athlete.primarySport ? (
              <p className="text-slate-600 text-sm mt-0.5">{athlete.primarySport}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Workout</h2>
          <p className="text-slate-900 font-medium">{workout.title}</p>
          <p className="text-slate-600 text-sm mt-1">{workout.workoutType}</p>
          {workout.estimatedDistanceInMeters != null && workout.estimatedDistanceInMeters > 0 ? (
            <p className="text-slate-600 text-sm mt-1">
              ~{(workout.estimatedDistanceInMeters / 1609.34).toFixed(1)} mi (plan distance)
            </p>
          ) : null}
          {workout.description ? (
            <p className="text-slate-700 whitespace-pre-wrap text-sm mt-3 leading-relaxed">{workout.description}</p>
          ) : null}
        </section>

        {workout.segments.length > 0 ? (
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <ListTree className="w-5 h-5 text-slate-500" />
              Structure
            </h2>
            <ul className="space-y-2 text-sm">
              {workout.segments.map((s) => (
                <li key={s.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <span className="font-medium text-slate-800">{s.title}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {s.durationType === "DISTANCE" ? `${s.durationValue} mi` : `${s.durationValue} min`}
                    {s.repeatCount != null && s.repeatCount > 1 ? ` ×${s.repeatCount}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Join this run</h2>
          <p className="text-slate-600 text-sm mb-4">RSVP on the CityRun page — same flow as other city runs.</p>
          {!cityRun ? (
            <p className="text-slate-500 text-sm">No public meetup is linked yet. Check back later.</p>
          ) : (
            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/80 space-y-2">
              <p className="font-semibold text-slate-900">{cityRun.title}</p>
              <p className="text-slate-600 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                {formatRunWhen(cityRun.date)}
              </p>
              <p className="text-slate-600 text-sm flex items-start gap-1.5">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {cityRun.meetUpPoint}
                  {cityRun.meetUpCity || cityRun.gofastCity
                    ? ` · ${cityRun.meetUpCity || cityRun.gofastCity}`
                    : ""}
                </span>
              </p>
              <Link
                href={cityRun.gorunPath}
                className="inline-flex items-center justify-center mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors w-full sm:w-auto"
              >
                View run & RSVP
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
