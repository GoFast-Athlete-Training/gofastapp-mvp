import { notFound, redirect } from 'next/navigation';
import {
  loadPublicRouteBySegment,
  publicHandleForRoute,
  resolveRouteIdBySegment,
} from '@/lib/city-run/resolve-route-segment';
import { athletePublicRouteSliceAppPath } from '@/lib/gofast-with-me/athlete-community-routes';
import RoutePublicSlice from '@/components/runs/RoutePublicSlice';

type PageProps = {
  params: Promise<{ routeId: string }>;
  searchParams: Promise<{ from?: string }>;
};

/** Legacy/id-only entry — canonical URL is `/u/{handle}/routes/{routeId}`. */
export default async function RouteSliceRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { routeId: segment } = await params;
  const { from } = await searchParams;
  const trimmed = segment?.trim();
  if (!trimmed) notFound();

  const resolvedId = await resolveRouteIdBySegment(trimmed);
  if (!resolvedId) notFound();

  const route = await loadPublicRouteBySegment(resolvedId);
  if (!route) notFound();

  const creatorHandle = await publicHandleForRoute(route);
  if (creatorHandle) {
    redirect(
      athletePublicRouteSliceAppPath(creatorHandle, resolvedId, {
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
