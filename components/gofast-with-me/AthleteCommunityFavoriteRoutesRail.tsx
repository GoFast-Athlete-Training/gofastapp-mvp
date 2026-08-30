import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';

type Props = {
  routes: AthleteRunRoutePayload[];
  firstName: string;
};

export default function AthleteCommunityFavoriteRoutesRail({ routes, firstName }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Routes</h2>
      </div>

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">My Routes — coming soon</p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-min gap-4">
            {routes.map((row) => {
              const mapUrl = row.route.mapImageUrl || row.route.stravaMapUrl;
              const meta = [
                row.route.distanceMiles != null ? `${row.route.distanceMiles} mi` : null,
                row.route.routeNeighborhood,
                row.route.citySlug,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <article
                  key={row.id}
                  className="w-80 shrink-0 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm"
                >
                  {mapUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mapUrl} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="h-40 bg-violet-50" />
                  )}
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                      Route
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-gray-900">{row.route.name}</h3>
                    {row.caption ? (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {row.caption}
                      </p>
                    ) : null}
                    {meta ? <p className="mt-2 text-xs text-gray-500">{meta}</p> : null}
                    {row.route.stravaUrl ? (
                      <a
                        href={row.route.stravaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-orange-700 hover:underline"
                      >
                        View on Strava →
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
