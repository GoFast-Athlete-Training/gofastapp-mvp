import { notFound, redirect } from 'next/navigation';
import RoutePublicSlice from '@/components/runs/RoutePublicSlice';
import { athletePublicRouteSliceAppPath } from '@/lib/gofast-with-me/athlete-community-routes';
import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';
import {
  loadPublicRouteBySegment,
  publicHandleForRoute,
  resolveRouteIdBySegment,
} from '@/lib/city-run/resolve-route-segment';

type PageProps = {
  params: Promise<{ handle: string; routeId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function AthleteRouteSlicePage({
  params,
  searchParams,
}: PageProps) {
  const { handle, routeId: segment } = await params;
  const { from } = await searchParams;
  const handleNorm = normalizeGoFastWithMeSlug(handle);
  const trimmed = segment?.trim();
  if (!handleNorm || !trimmed) notFound();

  const resolvedId = await resolveRouteIdBySegment(trimmed);
  if (!resolvedId) notFound();

  const route = await loadPublicRouteBySegment(resolvedId);
  if (!route) notFound();

  const creatorHandle = await publicHandleForRoute(route);
  if (creatorHandle && creatorHandle !== handleNorm) {
    redirect(
      athletePublicRouteSliceAppPath(creatorHandle, resolvedId, {
        from: typeof from === 'string' ? from : undefined,
      }),
    );
  }

  if (trimmed !== resolvedId) {
    redirect(
      athletePublicRouteSliceAppPath(handleNorm, resolvedId, {
        from: typeof from === 'string' ? from : undefined,
      }),
    );
  }

  const backHref =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
      ? from
      : null;

  return <RoutePublicSlice route={route} backHref={backHref} />;
}
