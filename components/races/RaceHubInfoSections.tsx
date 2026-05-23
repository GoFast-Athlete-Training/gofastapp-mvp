"use client";

import { ExternalLink, Trophy } from "lucide-react";
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
  publicRaceUrl,
  courseTipsUrl,
}: RaceHubAtAGlanceSectionProps) {
  if (!publicRaceUrl && !courseTipsUrl) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-2">
      {publicRaceUrl ? (
        <a
          href={publicRaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Full race info
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : null}
      {courseTipsUrl ? (
        <a
          href={courseTipsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          Course tips
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : null}
    </section>
  );
}
