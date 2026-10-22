'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import type { RoutePublicRow } from '@/lib/city-run/resolve-route-segment';
import { normalizeRoutePhotoUrls } from '@/lib/city-run/resolve-route-segment';
import { resolveCityRunStravaRouteUrl } from '@/lib/city-run/resolve-route-display';
import RunMilesPaceStrip from '@/components/runs/RunMilesPaceStrip';

type Props = {
  route: RoutePublicRow;
  backHref?: string | null;
};

export default function RoutePublicSlice({ route, backHref }: Props) {
  const router = useRouter();
  const photos = normalizeRoutePhotoUrls(route.routePhotos);
  const mapUrl = route.mapImageUrl?.trim() || photos[0] || null;
  const stravaUrl = resolveCityRunStravaRouteUrl({
    stravaMapUrl: route.stravaMapUrl,
    route: {
      stravaUrl: route.stravaUrl,
      stravaMapUrl: route.stravaMapUrl,
    },
  });
  const pathText = route.routeDescription?.trim() || null;
  const runType = route.runType?.trim() || null;
  const neighborhood = route.routeNeighborhood?.trim() || null;

  const onBack = () => {
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/gorun');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50">
      <div className="border-b border-sky-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-2 ring-sky-100"
            />
            <span className="text-sm font-bold text-gray-900">Route</span>
          </div>
          <span className="w-12" aria-hidden />
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-8">
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            {route.name}
          </h1>
          <div className="mt-4">
            <RunMilesPaceStrip totalMiles={route.distanceMiles} pace={null} />
          </div>

          {(runType || neighborhood || route.citySlug?.trim()) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {runType ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {runType}
                </span>
              ) : null}
              {neighborhood ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {neighborhood}
                </span>
              ) : null}
              {route.citySlug?.trim() && !neighborhood ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {route.citySlug.trim()}
                </span>
              ) : null}
            </div>
          ) : null}

          {mapUrl ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapUrl}
                alt="Route map"
                className="w-full h-auto max-h-72 object-contain"
              />
            </div>
          ) : null}

          {stravaUrl ? (
            <Link
              href={stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100"
            >
              View on Strava
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}

          {pathText ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Route path
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {pathText}
              </p>
            </div>
          ) : null}

          {photos.length > 1 ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Photos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {photos.slice(mapUrl === photos[0] ? 1 : 0).map((url) => (
                  <div
                    key={url}
                    className="overflow-hidden rounded-lg border border-gray-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-28 w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}
