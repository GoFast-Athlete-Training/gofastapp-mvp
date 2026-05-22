"use client";

import { Calendar, Clock, ExternalLink, Info, MapPin, Trophy } from "lucide-react";
import {
  formatSecPerMileForHub,
  type MyRaceResultRow,
} from "@/components/races/race-hub-types";

type RaceHubMyResultSectionProps = {
  myRaceResult: MyRaceResultRow | null;
  onOpenLogSheet: () => void;
};

export function RaceHubMyResultSection({
  myRaceResult,
  onOpenLogSheet,
}: RaceHubMyResultSectionProps) {
  return (
    <section
      id="log-result"
      className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm p-4 sm:p-6 scroll-mt-24"
    >
      <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        My result
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Log or update your finish time for this race. It stays on your profile and home, not posted to
        the group feed.
      </p>
      {myRaceResult ? (
        <div className="space-y-2 text-sm">
          {myRaceResult.officialFinishTime ? (
            <p className="text-emerald-900">
              <span className="font-semibold">Time:</span>{" "}
              <span className="tabular-nums font-medium">{myRaceResult.officialFinishTime}</span>
              {myRaceResult.source === "garmin" ? (
                <span className="text-gray-500 font-normal"> · from Garmin</span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-gray-700">Result on file (open below to add times).</p>
          )}
          {myRaceResult.overallPlace != null ? (
            <p className="text-gray-800">
              <span className="font-semibold text-gray-700">Overall:</span> {myRaceResult.overallPlace}
              {myRaceResult.ageGroupPlace != null ? ` · AG ${myRaceResult.ageGroupPlace}` : null}
            </p>
          ) : null}
          {myRaceResult.actualAvgPaceSecPerMile != null ? (
            <p className="text-gray-800">
              <span className="font-semibold text-gray-700">Pace:</span>{" "}
              {formatSecPerMileForHub(myRaceResult.actualAvgPaceSecPerMile)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          No result logged yet. Add your time after race day, even if your watch didn&apos;t upload a
          file.
        </p>
      )}
      <button
        type="button"
        onClick={onOpenLogSheet}
        className="mt-4 w-full inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        {myRaceResult ? "Update result" : "Log your result"}
      </button>
    </section>
  );
}

type RaceHubAtAGlanceSectionProps = {
  dateLabel: string | null;
  raceStartLabel: string | null;
  locationText: string | null;
  distanceChips: string[];
  distanceFallback: string | null;
  publicRaceUrl: string | null;
  courseTipsUrl: string | null;
};

export function RaceHubAtAGlanceSection({
  dateLabel,
  raceStartLabel,
  locationText,
  distanceChips,
  distanceFallback,
  publicRaceUrl,
  courseTipsUrl,
}: RaceHubAtAGlanceSectionProps) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Info className="w-5 h-5 text-orange-600" />
        At a glance
      </h2>
      <div className="space-y-3 text-sm">
        {dateLabel ? (
          <div className="flex gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Date</p>
              <p className="text-gray-700">{dateLabel}</p>
            </div>
          </div>
        ) : null}
        {raceStartLabel ? (
          <div className="flex gap-2">
            <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Start</p>
              <p className="text-gray-700">{raceStartLabel}</p>
            </div>
          </div>
        ) : null}
        {locationText ? (
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Location</p>
              <p className="text-gray-700">{locationText}</p>
            </div>
          </div>
        ) : null}
        {distanceChips.length > 0 ? (
          <div>
            <p className="font-semibold text-gray-900 mb-1">Distances</p>
            <p className="text-gray-700">{distanceChips.join(" · ")}</p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-gray-900 mb-1">Distance</p>
            <p className="text-gray-700">{distanceFallback ?? "—"}</p>
          </div>
        )}
      </div>
      {publicRaceUrl ? (
        <a
          href={publicRaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Full race info
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : (
        <p className="mt-4 text-xs text-gray-500">
          Public race page link appears when this race has a slug on the catalog. Packet pickup, course
          map, and registration stay there.
        </p>
      )}
      {courseTipsUrl ? (
        <a
          href={courseTipsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          Course tips
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : null}
    </section>
  );
}
