'use client';

import { Map, MapPin } from 'lucide-react';
import CityRunRouteMedia from '@/components/runs/CityRunRouteMedia';
import type { CityRunDetails } from '@/components/runs/city-run-types';
import { isRunPast } from '@/components/runs/city-run-types';

type CityRunRunDayCompanionProps = {
  run: CityRunDetails;
  runIsPast?: boolean;
  onAddShout?: () => void;
  checkingIn?: boolean;
};

export default function CityRunRunDayCompanion({
  run,
  runIsPast,
  onAddShout,
  checkingIn = false,
}: CityRunRunDayCompanionProps) {
  const past = runIsPast ?? isRunPast(run.date);
  const stravaUrl = run.stravaMapUrl?.trim() || null;
  const courseText =
    run.workoutDescription?.trim() ||
    run.description?.trim() ||
    null;

  if (past) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-orange-950">Tell us how it went</h2>
        <p className="mt-1 text-sm text-orange-900/80">
          Share a shout-out with the crew who showed up.
        </p>
        {onAddShout ? (
          <button
            type="button"
            onClick={onAddShout}
            disabled={checkingIn}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {checkingIn ? 'Opening…' : 'Add a shout-out →'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-bold text-sky-950">Good luck with the run!</h2>
        <p className="mt-1 text-sm text-sky-900/80">
          Here&apos;s the map and course description if you need it. We&apos;ll catch you when
          you&apos;re back.
        </p>
      </div>

      {courseText ? (
        <div className="rounded-lg border border-sky-100 bg-white p-4 text-sm text-gray-700 whitespace-pre-wrap">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            <MapPin className="h-3.5 w-3.5" />
            Course / workout
          </div>
          {courseText}
        </div>
      ) : null}

      {stravaUrl ? (
        <a
          href={stravaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50"
        >
          <Map className="h-4 w-4" />
          View route on Strava
        </a>
      ) : null}

      <CityRunRouteMedia routePhotos={run.routePhotos} mapImageUrl={run.mapImageUrl} />
    </div>
  );
}
