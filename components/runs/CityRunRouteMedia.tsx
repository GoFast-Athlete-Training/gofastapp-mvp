'use client';

interface CityRunRouteMediaProps {
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  stravaMapUrl?: string | null;
}

function normalizeRoutePhotoUrls(routePhotos?: string[] | null): string[] {
  if (!Array.isArray(routePhotos)) return [];
  return routePhotos
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim());
}

/**
 * Route photos + optional route map image. Omits empty photo slots and does not show a
 * dashed "add map" placeholder (Strava link lives on the run detail card above).
 */
export default function CityRunRouteMedia({
  routePhotos,
  mapImageUrl,
}: CityRunRouteMediaProps) {
  const photos = normalizeRoutePhotoUrls(routePhotos);

  return (
    <>
      {photos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Route Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {photos.map((photoUrl, idx) => (
                <div key={`${photoUrl}-${idx}`} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
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
              <img src={mapImageUrl} alt="Route map" className="w-full max-h-56 object-cover" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
