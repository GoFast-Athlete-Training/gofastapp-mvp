"use client";

import Link from "next/link";
import { Calendar, Clock, Gauge, MapPin, Route } from "lucide-react";
import { dateKeyFromIsoOrDateKey } from "@/lib/calendar-date";

export type DiscoverRunCardRun = {
  id: string;
  slug?: string | null;
  title: string;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string;
  totalMiles: number | null;
  pace: string | null;
  runClub?: { slug: string; name: string; logoUrl: string | null } | null;
};

function formatRunTime(run: DiscoverRunCardRun): string {
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

function runRsvpDetailPath(run: DiscoverRunCardRun): string {
  const segment = run.slug?.trim() || run.id;
  return `/runrsvp/${encodeURIComponent(segment)}`;
}

export default function DiscoverRunCard({ run }: { run: DiscoverRunCardRun }) {
  const time = formatRunTime(run);
  const clubSlug = run.runClub?.slug?.trim();
  const milesLabel =
    run.totalMiles != null && Number.isFinite(run.totalMiles)
      ? `${Number(run.totalMiles)} mi`
      : null;
  const paceLabel = run.pace?.trim() || null;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-semibold text-gray-900">{run.title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
              {formatRunDate(run.date)}
            </span>
            {time ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
                {time}
              </span>
            ) : null}
            <span className="inline-flex items-start gap-1.5 min-w-0">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
              <span className="truncate">{run.meetUpPoint}</span>
            </span>
            {milesLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <Route className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-gray-900">Miles:</span> {milesLabel}
                </span>
              </span>
            ) : null}
            {paceLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-gray-900">Paces:</span> {paceLabel}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
          {run.runClub?.logoUrl ? (
            clubSlug ? (
              <Link href={`/runclub/${encodeURIComponent(clubSlug)}`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={run.runClub.logoUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={run.runClub.logoUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            )
          ) : null}
          {clubSlug ? (
            <Link
              href={`/runclub/${encodeURIComponent(clubSlug)}`}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              See club
            </Link>
          ) : null}
          <Link
            href={runRsvpDetailPath(run)}
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
          >
            More details
          </Link>
        </div>
      </div>
    </article>
  );
}
