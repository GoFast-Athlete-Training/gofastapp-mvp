"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Copy, ExternalLink, MapPin, Users } from "lucide-react";
import api from "@/lib/api";
import { athleteCityToSlug, DC_REGION_SLUG } from "@/lib/region-slug";
import { getPublicRunContentUrl } from "@/lib/publicRunUrl";
import { dateKeyFromIsoOrDateKey } from "@/lib/calendar-date";

type DiscoverMode = "schedule" | "club";

type DiscoveryRun = {
  id: string;
  slug?: string | null;
  title: string;
  citySlug: string;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string;
  totalMiles: number | null;
  pace: string | null;
  published?: boolean;
  runClub?: { slug: string; name: string; logoUrl: string | null; city: string | null } | null;
};

type DiscoveryRunClub = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  upcomingRunCount: number;
  nextRun: DiscoveryRun | null;
  runs: DiscoveryRun[];
};

type DiscoverScope =
  | { mode: "city"; citySlug: string }
  | { mode: "region"; regionSlug: string };

function formatRunTime(run: DiscoveryRun): string {
  const h = run.startTimeHour;
  if (h == null) return "";
  const m = run.startTimeMinute ?? 0;
  const p = run.startTimePeriod?.toLowerCase() === "pm" ? "PM" : "AM";
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mm} ${p}`;
}

function formatRunDate(iso: string): string {
  const key = dateKeyFromIsoOrDateKey(iso);
  if (!key) return iso;
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function RunDiscoverActions({ run }: { run: DiscoveryRun }) {
  const segment = run.slug?.trim() || run.id;
  const publicUrl = getPublicRunContentUrl({
    runId: run.id,
    slug: run.slug,
    citySlug: run.citySlug,
  });

  const copyPublic = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Link
        href={`/gorun/${encodeURIComponent(segment)}`}
        className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
      >
        Open in app
      </Link>
      <a
        href={publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:border-sky-300"
      >
        Public page
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        type="button"
        onClick={() => void copyPublic()}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        <Copy className="h-3 w-3" />
        Copy public link
      </button>
      {!run.published ? (
        <span className="text-xs font-medium text-amber-700">Not published on dcruns yet</span>
      ) : null}
    </div>
  );
}

function RunDiscoverCard({ run }: { run: DiscoveryRun }) {
  const time = formatRunTime(run);
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{run.title}</h3>
          {run.runClub?.name ? (
            <p className="text-sm text-gray-600 mt-0.5">{run.runClub.name}</p>
          ) : null}
        </div>
        {run.runClub?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={run.runClub.logoUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover shrink-0"
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-4 w-4 text-gray-400" />
          {formatRunDate(run.date)}
        </span>
        {time ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4 text-gray-400" />
            {time}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4 text-gray-400" />
          {run.meetUpPoint}
        </span>
      </div>
      {(run.totalMiles != null || run.pace) && (
        <p className="text-xs text-gray-500 mt-1">
          {[run.totalMiles != null ? `${run.totalMiles} mi` : null, run.pace].filter(Boolean).join(" · ")}
        </p>
      )}
      <RunDiscoverActions run={run} />
    </article>
  );
}

export default function WebRunsDiscover() {
  const [mode, setMode] = useState<DiscoverMode>("schedule");
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [clubs, setClubs] = useState<DiscoveryRunClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<DiscoverScope>({ mode: "region", regionSlug: DC_REGION_SLUG });
  const [athleteCitySlug, setAthleteCitySlug] = useState<string>("unknown");

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.post<{
          success?: boolean;
          identity?: { city?: string | null; state?: string | null };
        }>("/athlete/identity", {});
        const city = res.data?.identity?.city;
        const state = res.data?.identity?.state;
        const slug = athleteCityToSlug(city, state);
        setAthleteCitySlug(slug);
        if (slug !== "unknown") {
          setScope({ mode: "city", citySlug: slug });
        }
      } catch {
        /* keep DMV region default */
      }
    })();
  }, []);

  const discoveryParams = useMemo(() => {
    if (scope.mode === "region") {
      return { regionSlug: scope.regionSlug };
    }
    return { citySlug: scope.citySlug };
  }, [scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, clubsRes] = await Promise.all([
        api.get<{ success?: boolean; runs?: DiscoveryRun[] }>("/runs/discovery", {
          params: discoveryParams,
        }),
        api.get<{ success?: boolean; clubs?: DiscoveryRunClub[] }>("/run-clubs/discovery", {
          params: discoveryParams,
        }),
      ]);
      setRuns(Array.isArray(runsRes.data?.runs) ? runsRes.data.runs : []);
      setClubs(Array.isArray(clubsRes.data?.clubs) ? clubsRes.data.clubs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load discover runs");
      setRuns([]);
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }, [discoveryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const exploreDmv = () => setScope({ mode: "region", regionSlug: DC_REGION_SLUG });
  const backToMyCity = () => {
    if (athleteCitySlug !== "unknown") {
      setScope({ mode: "city", citySlug: athleteCitySlug });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Discover group runs</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Club runs you build show here for testing — including before they are published on dcruns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {scope.mode === "city" ? (
            <button
              type="button"
              onClick={exploreDmv}
              className="text-sm font-semibold text-sky-700 hover:underline"
            >
              Explore DMV area
            </button>
          ) : (
            athleteCitySlug !== "unknown" && (
              <button
                type="button"
                onClick={backToMyCity}
                className="text-sm font-semibold text-sky-700 hover:underline"
              >
                Back to my city
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode("schedule")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold ${
            mode === "schedule" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
          }`}
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={() => setMode("club")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold ${
            mode === "club" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
          }`}
        >
          By club
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading runs…</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-4">{error}</p>
      ) : mode === "schedule" ? (
        runs.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No upcoming club runs in this area. Try Explore DMV area or publish a run from Run Manage.
          </p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <RunDiscoverCard key={run.id} run={run} />
            ))}
          </div>
        )
      ) : clubs.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No run clubs in this area yet.</p>
      ) : (
        <div className="space-y-4">
          {clubs.map((club) => (
            <div key={club.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3 mb-3">
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-sky-700" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{club.name}</h3>
                  <p className="text-xs text-gray-500">
                    {club.upcomingRunCount} upcoming
                    {club.city ? ` · ${club.city}` : ""}
                  </p>
                </div>
              </div>
              {club.runs.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming runs on the calendar.</p>
              ) : (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  {club.runs.map((run) => (
                    <RunDiscoverCard key={run.id} run={{ ...run, runClub: club }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
