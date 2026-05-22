"use client";

import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import type { RaceEventRow, ShakeoutRunRow } from "@/components/races/race-hub-types";

type RaceHubShakeoutsSectionProps = {
  shakeouts: ShakeoutRunRow[];
  onSetShakeoutRunRsvp: (runId: string, status: "going" | "not-going") => void;
};

export function RaceHubShakeoutsSection({
  shakeouts,
  onSetShakeoutRunRsvp,
}: RaceHubShakeoutsSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Official shakeouts</h2>
        <p className="text-sm text-gray-500 mt-1">
          City runs synced from race HQ — same RSVPs and check-ins as club runs.
        </p>
      </div>
      {shakeouts.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          No official shakeouts yet. Check back closer to race day.
        </p>
      ) : (
        <ul className="space-y-4">
          {shakeouts.map((sh) => {
            const my = sh.myRsvp?.status ?? null;
            const isGoing = my === "going";
            const isCantGo = my === "not-going";

            const timeLabel = (() => {
              if (sh.startTimeHour == null) return null;
              const min =
                sh.startTimeMinute != null ? String(sh.startTimeMinute).padStart(2, "0") : "00";
              return `${sh.startTimeHour}:${min} ${sh.startTimePeriod ?? ""}`.trim();
            })();

            const dateLabel = new Date(sh.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });

            return (
              <li
                key={sh.id}
                className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-500" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-base leading-snug">{sh.title}</p>
                      {sh.runClub ? (
                        <p className="text-xs text-orange-600 font-medium mt-0.5">
                          Hosted by {sh.runClub.name}
                        </p>
                      ) : null}
                    </div>
                    {sh.rsvpCount > 0 ? (
                      <span className="flex-shrink-0 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                        {sh.rsvpCount} going
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>
                        {dateLabel}
                        {timeLabel ? ` · ${timeLabel}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{sh.meetUpPoint}</span>
                    </div>
                    {sh.totalMiles != null || sh.pace ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {sh.totalMiles != null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {sh.totalMiles} mi
                          </span>
                        ) : null}
                        {sh.pace ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {sh.pace}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {sh.description ? (
                    <p className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {sh.description}
                    </p>
                  ) : null}
                  {sh.postRunActivity ? (
                    <p className="mt-1.5 text-xs text-gray-500 italic">After: {sh.postRunActivity}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onSetShakeoutRunRsvp(sh.id, "going")}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isGoing
                          ? "bg-green-600 text-white"
                          : "bg-orange-500 hover:bg-orange-600 text-white"
                      }`}
                    >
                      {isGoing ? "✓ I'm in" : "I'm in"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSetShakeoutRunRsvp(sh.id, "not-going")}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isCantGo
                          ? "bg-gray-600 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      Can&apos;t make it
                    </button>
                    <Link
                      href={sh.gorunPath}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                    >
                      Run details
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type RaceHubEventsSectionProps = {
  events: RaceEventRow[];
  onSetRsvp: (eventId: string, status: "going" | "not-going" | "maybe") => void;
};

export function RaceHubEventsSection({ events, onSetRsvp }: RaceHubEventsSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Group runs &amp; meetups</h2>
        <p className="text-sm text-gray-500 mt-1">
          Community-led meetups — brunch runs, carpools, informal hangs.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          No group runs or meetups yet. Post one for the crew.
        </p>
      ) : (
        <ul className="space-y-4">
          {events.map((ev) => {
            const myStatus = ev.race_event_rsvps?.[0]?.status ?? null;
            return (
              <li key={ev.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="font-semibold text-gray-900">{ev.title}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(ev.date).toLocaleDateString()} · {ev.time} · {ev.venue}
                </p>
                {ev.description ? (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{ev.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["going", "maybe", "not-going"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void onSetRsvp(ev.id, status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        myStatus === status
                          ? status === "going"
                            ? "bg-green-600 text-white"
                            : status === "maybe"
                              ? "bg-amber-500 text-white"
                              : "bg-gray-600 text-white"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }`}
                    >
                      {status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Can't go"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
