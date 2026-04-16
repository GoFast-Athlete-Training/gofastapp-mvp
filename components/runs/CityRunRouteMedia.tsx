'use client';

import { Map, ExternalLink } from 'lucide-react';

interface CityRunRouteMediaProps {
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  stravaMapUrl?: string | null;
}

/**
 * Route photos + map image / placeholder — aligned with gofast-contentpublic PublicRunContainer.
 */
export default function CityRunRouteMedia({
  routePhotos,
  mapImageUrl,
  stravaMapUrl,
}: CityRunRouteMediaProps) {
  const photos = routePhotos && routePhotos.length > 0 ? routePhotos : null;

  return (
    <>
      {photos && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Route Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {photos.map((photoUrl, idx) => (
                <div key={idx} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <img src={photoUrl} alt={`Route photo ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mapImageUrl ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Route Map</h2>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <img src={mapImageUrl} alt="Route map" className="w-full h-auto" />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Route map</h2>
          <p className="text-sm text-gray-500">
            Map preview will appear here once the team adds a Strava route screenshot.
          </p>
          {stravaMapUrl && (
            <a
              href={stravaMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-sm font-medium mt-3"
            >
              <Map className="h-4 w-4 shrink-0" />
              View route on Strava <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </>
  );
}
