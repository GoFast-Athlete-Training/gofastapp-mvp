"use client";

import Image from "next/image";
import Link from "next/link";
import { RacePrepForkActions } from "@/components/races/RacePrepForkActions";
import type { MyRacePointJson } from "@/lib/races/load-my-race";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";

type Props = {
  myRace: MyRacePointJson;
  /** When set, overrides myRace.raceDayBuilderHref for the selected calendar day. */
  raceDayBuilderHref?: string | null;
  dayLabel?: string | null;
  compact?: boolean;
};

function formatPaceSecPerMi(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

export function AthleteRacePoint({
  myRace,
  raceDayBuilderHref,
  dayLabel,
  compact,
}: Props) {
  const builderHref = raceDayBuilderHref?.trim() || myRace.raceDayBuilderHref?.trim() || null;
  const dateDisplay = formatPlanDateDisplay(myRace.raceDate, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="flex flex-wrap items-start gap-4">
        {myRace.logoUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-violet-200 bg-white">
            <Image
              src={myRace.logoUrl}
              alt=""
              fill
              className="object-contain p-1"
              sizes="64px"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-lg font-bold text-violet-800"
            aria-hidden
          >
            {myRace.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{myRace.name}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {dayLabel ? `${dayLabel} · ` : ""}
            {dateDisplay}
            {myRace.distanceLabel ? ` · ${myRace.distanceLabel}` : ""}
            {myRace.locationLabel ? ` · ${myRace.locationLabel}` : ""}
          </p>
          {myRace.startTimeLabel ? (
            <p className="mt-2 text-sm font-semibold text-violet-900">
              Official start: {myRace.startTimeLabel}
            </p>
          ) : null}
          {myRace.goalTime ? (
            <p className="mt-1 text-sm text-gray-700">
              Goal: <span className="font-semibold">{myRace.goalTime}</span>
              {myRace.goalRacePaceSecPerMile
                ? ` · ${formatPaceSecPerMi(myRace.goalRacePaceSecPerMile)}`
                : ""}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">
        Build named pace targets for race day, save them on your plan, then send the workout to your
        Garmin Connect calendar from Plan my race.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {builderHref ? (
          <Link
            href={builderHref}
            className="inline-flex justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Build / edit pace markers
          </Link>
        ) : null}
        <Link
          href={`/training/day/${myRace.raceDate}`}
          className="inline-flex justify-center rounded-xl border-2 border-violet-300 bg-white px-6 py-3 text-sm font-semibold text-violet-900 hover:bg-violet-50"
        >
          Race day detail
        </Link>
      </div>

      <RacePrepForkActions
        plannerHref={myRace.plannerHref}
        raceHubHref={myRace.raceHubHref}
        variant="compact"
        layout="row"
      />
    </div>
  );
}
