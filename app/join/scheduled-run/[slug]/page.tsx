"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, MapPin, Route, User } from "lucide-react";
import TopNav from "@/components/shared/TopNav";

type Payload = {
  success: boolean;
  scheduledRun: {
    title: string;
    date: string;
    startTimeLabel: string | null;
    estimatedFinishLabel: string | null;
    estimatedDistanceMi: number | null;
    isTrack: boolean;
    stravaRouteUrl: string | null;
    meetupLocation: string | null;
    routeDescription: string | null;
  };
  athlete: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function athleteDisplayName(a: Payload["athlete"]): string {
  if (!a) return "A runner";
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (a.gofastHandle) return `@${a.gofastHandle.replace(/^@/, "")}`;
  return "A runner";
}

export default function JoinScheduledRunPage() {
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
        const res = await fetch(
          `/api/training/schedule-run/public/${encodeURIComponent(slug)}`
        );
        const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (cancelled) return;
        if (!res.ok || !json.success) {
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

  const run = data?.scheduledRun;
  const athlete = data?.athlete;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="max-w-lg mx-auto px-4 py-10">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
          </div>
        ) : error || !run ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-gray-800">{error || "Run not found"}</p>
            <Link href="/" className="mt-4 inline-block text-sky-700 font-medium">
              Go to GoFast
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8 text-white">
              <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">
                Run with
              </p>
              <div className="mt-3 flex items-center gap-3">
                {athlete?.photoURL ? (
                  <Image
                    src={athlete.photoURL}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded-full border-2 border-white/30 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <p className="text-xl font-bold">{athleteDisplayName(athlete ?? null)}</p>
                  {athlete?.city || athlete?.state ? (
                    <p className="text-orange-100 text-sm">
                      {[athlete.city, athlete.state].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="px-6 py-6 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">{run.title}</h1>

              <div className="flex items-start gap-2 text-gray-700">
                <Calendar className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <p>{formatRunDate(run.date)}</p>
              </div>

              {run.startTimeLabel ? (
                <div className="flex items-start gap-2 text-gray-700">
                  <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <p>
                    Start {run.startTimeLabel}
                    {run.estimatedFinishLabel
                      ? ` · ~done by ${run.estimatedFinishLabel}`
                      : ""}
                  </p>
                </div>
              ) : null}

              {run.estimatedDistanceMi != null && run.estimatedDistanceMi > 0 ? (
                <p className="text-sm text-gray-600">
                  ~{run.estimatedDistanceMi % 1 === 0 ? run.estimatedDistanceMi.toFixed(0) : run.estimatedDistanceMi.toFixed(1)} mi
                  {run.isTrack ? " · track" : ""}
                </p>
              ) : run.isTrack ? (
                <p className="text-sm text-gray-600">Track workout</p>
              ) : null}

              {run.meetupLocation ? (
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <p>{run.meetupLocation}</p>
                </div>
              ) : null}

              {run.routeDescription ? (
                <p className="text-sm text-gray-600 border-l-2 border-orange-200 pl-3">
                  {run.routeDescription}
                </p>
              ) : null}

              {run.stravaRouteUrl ? (
                <a
                  href={run.stravaRouteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  <Route className="w-4 h-4" />
                  View Strava route
                </a>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
