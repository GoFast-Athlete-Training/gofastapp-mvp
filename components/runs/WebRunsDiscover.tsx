"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Copy, ExternalLink, MapPin } from "lucide-react";
import api from "@/lib/api";
import { getPublicRunContentUrl } from "@/lib/publicRunUrl";
import { dateKeyFromIsoOrDateKey } from "@/lib/calendar-date";
import { isAxiosError } from "axios";

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
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingCity, setMissingCity] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingCity(false);
    try {
      const runsRes = await api.get<{ success?: boolean; runs?: DiscoveryRun[] }>("/runs/discovery");
      setRuns(Array.isArray(runsRes.data?.runs) ? runsRes.data.runs : []);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 400) {
        const body = e.response.data as { code?: string; error?: string };
        if (body?.code === "missing_athlete_city") {
          setMissingCity(true);
          setRuns([]);
          setError(null);
          setLoading(false);
          return;
        }
        setError(typeof body?.error === "string" ? body.error : "Could not load runs.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load discover runs");
      }
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Find a run</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Club runs in your region, including drafts you are testing before publishing on dcruns.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading runs…</p>
      ) : missingCity ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center space-y-3">
          <p className="text-gray-700 font-medium">Add your city to find runs near you</p>
          <p className="text-sm text-gray-500">
            We use your profile city to show your metro area without loading every city in the country.
          </p>
          <Link
            href="/settings"
            className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Update profile
          </Link>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 py-4">{error}</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No upcoming club runs in your area yet. Publish a run from Run Manage or check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunDiscoverCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
