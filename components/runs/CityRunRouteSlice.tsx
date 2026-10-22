'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { CityRunDetails } from '@/components/runs/city-run-types';

type Props = {
  run: CityRunDetails;
  publicDoorHref: string;
};

export default function CityRunRouteSlice({ run, publicDoorHref }: Props) {
  const thumb =
    run.mapImageUrl ||
    (typeof run.routePhotos === 'object' &&
    Array.isArray(run.routePhotos) &&
    run.routePhotos[0]
      ? String(run.routePhotos[0])
      : null);
  const miles =
    run.totalMiles != null ? `${run.totalMiles} mi` : null;
  const strava = run.stravaMapUrl?.trim() || null;

  if (!thumb && !miles && !strava) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Route
      </p>
      <div className="mt-2 flex gap-3">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 text-sm">
          {miles ? <p className="font-semibold text-gray-900">{miles}</p> : null}
          {run.pace?.trim() ? (
            <p className="text-gray-600">{run.pace.trim()}</p>
          ) : null}
          {strava ? (
            <Link
              href={strava}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
            >
              Strava
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <Link
            href={publicDoorHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm font-semibold text-sky-700 hover:underline"
          >
            Full invite on GoFast Links →
          </Link>
        </div>
      </div>
    </div>
  );
}
