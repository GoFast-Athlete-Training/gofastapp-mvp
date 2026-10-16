'use client';

import { ExternalLink } from 'lucide-react';
import {
  resolveCityRunRoutePathDescription,
  resolveCityRunStravaRouteUrl,
} from '@/lib/city-run/resolve-route-display';

interface CityRunRouteMediaProps {
  routePhotos?: string[] | null;
  runPhotos?: string[] | null;
  mapImageUrl?: string | null;
  stravaMapUrl?: string | null;
  workoutDescription?: string | null;
  directionsText?: string | null;
  route?: {
    routeDescription?: string | null;
    stravaUrl?: string | null;
    stravaMapUrl?: string | null;
    mapImageUrl?: string | null;
  } | null;
}

function normalizeRoutePhotoUrls(routePhotos?: string[] | null): string[] {
  if (!Array.isArray(routePhotos)) return [];
  return routePhotos
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim());
}

export default function CityRunRouteMedia({
  routePhotos,
  runPhotos,
  mapImageUrl,
  stravaMapUrl,
  workoutDescription,
  directionsText,
  route,
}: CityRunRouteMediaProps) {
  const routePhotoUrls = normalizeRoutePhotoUrls(routePhotos);
  const runPhotoUrls = normalizeRoutePhotoUrls(runPhotos);

  const mapUrl =
    mapImageUrl?.trim() || route?.mapImageUrl?.trim() || null;
  const stravaUrl = resolveCityRunStravaRouteUrl({
    stravaMapUrl,
    route,
  });
  const pathDescription = resolveCityRunRoutePathDescription({
    workoutDescription,
    route,
  });
  const directions = directionsText?.trim() || null;

  const hasRouteBlock =
    mapUrl || stravaUrl || pathDescription || directions || routePhotoUrls.length > 0;

  if (!hasRouteBlock && runPhotoUrls.length === 0) return null;

  return (
    <>
      {hasRouteBlock ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Route</h2>

            {mapUrl ? (
              <div className="w-full max-h-72 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapUrl}
                  alt="Route map"
                  className="w-full h-auto max-h-72 object-contain"
                />
              </div>
            ) : null}

            {stravaUrl ? (
              <a
                href={stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                View route on Strava
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            ) : null}

            {pathDescription ? (
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{pathDescription}</p>
            ) : null}

            {directions && directions !== pathDescription ? (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Directions
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{directions}</p>
              </div>
            ) : null}

            {routePhotoUrls.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {routePhotoUrls.map((photoUrl, idx) => (
                  <div
                    key={`${photoUrl}-${idx}`}
                    className="aspect-video rounded-lg overflow-hidden bg-gray-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt={`Route photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {runPhotoUrls.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Photos of the run</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {runPhotoUrls.map((photoUrl, idx) => (
                <div key={`run-${photoUrl}-${idx}`} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt={`Run photo ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
