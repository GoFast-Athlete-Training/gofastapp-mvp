import type { Prisma } from '@prisma/client';

export type CourseSnapSource = 'city_run_rsvp' | 'city_run_reschedule';

export type CourseSnapDocument = {
  v: 1;
  capturedAt: string;
  source: CourseSnapSource;
  routeId: string | null;
  name: string | null;
  stravaUrl: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  distanceMiles: number | null;
  meetUpPoint: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
};

type RunWithRoute = {
  meetUpPoint: string;
  meetUpLat: number | null;
  meetUpLng: number | null;
  totalMiles: number | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routeId: string | null;
  route?: {
    id: string;
    name: string;
    stravaUrl: string | null;
    stravaMapUrl: string | null;
    mapImageUrl: string | null;
    distanceMiles: number | null;
  } | null;
};

export function buildCourseSnapFromRun(
  run: RunWithRoute,
  source: CourseSnapSource
): CourseSnapDocument {
  const route = run.route;
  return {
    v: 1,
    capturedAt: new Date().toISOString(),
    source,
    routeId: run.routeId ?? route?.id ?? null,
    name: route?.name ?? null,
    stravaUrl: route?.stravaUrl ?? null,
    stravaMapUrl: run.stravaMapUrl ?? route?.stravaMapUrl ?? null,
    mapImageUrl: run.mapImageUrl ?? route?.mapImageUrl ?? null,
    distanceMiles: run.totalMiles ?? route?.distanceMiles ?? null,
    meetUpPoint: run.meetUpPoint ?? null,
    meetUpLat: run.meetUpLat ?? null,
    meetUpLng: run.meetUpLng ?? null,
  };
}

export function courseSnapToJson(doc: CourseSnapDocument): Prisma.InputJsonValue {
  return doc as unknown as Prisma.InputJsonValue;
}
