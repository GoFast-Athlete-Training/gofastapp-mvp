"use client";

import { MapPin, Timer, Trophy } from "lucide-react";
import { RacePrepForkActions } from "@/components/races/RacePrepForkActions";

export type RaceDayGoalBannerProps = {
  raceName: string;
  distanceLabel?: string | null;
  plannerHref: string | null | undefined;
  raceHubHref: string | null | undefined;
  /** e.g. athlete first name for “Go crush it, Adam!” */
  cheerName?: string | null;
  locationLabel?: string | null;
  startTimeLabel?: string | null;
};

/** Shared race-day prep chrome — planner + public hub fork; does not replace page content. */
export function RaceDayGoalBanner({
  raceName,
  distanceLabel,
  plannerHref,
  raceHubHref,
  cheerName,
  locationLabel,
  startTimeLabel,
}: RaceDayGoalBannerProps) {
  const loc = locationLabel?.trim() || null;
  const stTime = startTimeLabel?.trim() || null;

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-400 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4 min-w-0">
          <Trophy className="h-12 w-12 shrink-0 text-amber-200" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-100">
              Today is race day
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight">{raceName}</h2>
            {distanceLabel?.trim() ? (
              <p className="mt-1 text-lg font-semibold text-violet-100">{distanceLabel.trim()}</p>
            ) : null}
            <p className="mt-3 text-xl font-bold text-white">
              Go crush it
              {cheerName?.trim() ? `, ${cheerName.trim()}` : ""}!
            </p>
            {loc || stTime ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-violet-100">
                {loc ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {loc}
                  </span>
                ) : null}
                {stTime ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Timer className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {stTime}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <RacePrepForkActions
          plannerHref={plannerHref}
          raceHubHref={raceHubHref}
          variant="heroDark"
        />
      </div>
    </div>
  );
}
