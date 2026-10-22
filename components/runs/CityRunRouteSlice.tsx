'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type { CityRunDetails } from '@/components/runs/city-run-types';
import { cityRunRouteSlicePath } from '@/lib/city-run/run-nav-paths';
import RunMilesPaceStrip from '@/components/runs/RunMilesPaceStrip';

type Props = {
  run: CityRunDetails;
};

export default function CityRunRouteSlice({ run }: Props) {
  const pathname = usePathname();
  const routeId =
    run.route?.id?.trim() ||
    (typeof (run as { routeId?: string | null }).routeId === 'string'
      ? (run as { routeId: string }).routeId.trim()
      : null) ||
    null;
  const thumb =
    run.mapImageUrl ||
    run.route?.mapImageUrl?.trim() ||
    (typeof run.routePhotos === 'object' &&
    Array.isArray(run.routePhotos) &&
    run.routePhotos[0]
      ? String(run.routePhotos[0])
      : null);
  const strava =
    run.stravaMapUrl?.trim() ||
    run.route?.stravaMapUrl?.trim() ||
    run.route?.stravaUrl?.trim() ||
    null;
  const routeName = run.route?.name?.trim() || null;
  const hasStats =
    run.totalMiles != null || Boolean(run.pace?.trim());

  if (!thumb && !strava && !routeId && !hasStats && !routeName) return null;

  const routeHref = routeId
    ? cityRunRouteSlicePath(routeId, { from: pathname || undefined })
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Route
      </p>
      {routeName ? (
        <p className="mt-1 text-sm font-semibold text-gray-900">{routeName}</p>
      ) : null}

      <div className="mt-3 flex gap-3">
        {thumb && routeHref ? (
          <Link href={routeHref} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200"
            />
          </Link>
        ) : thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <RunMilesPaceStrip
            totalMiles={run.totalMiles}
            pace={run.pace}
            compact
          />
          {strava ? (
            <Link
              href={strava}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
            >
              Strava map
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {routeHref ? (
        <Link
          href={routeHref}
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-sky-200 bg-sky-50 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
        >
          See full route →
        </Link>
      ) : null}
    </div>
  );
}
