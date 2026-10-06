import type { CityRunDetails, CityRunRsvp, RunSeries } from '@/components/runs/city-run-types';

/** Shape from GET /api/runs/public/[runId] */
export type PublicCityRunPayload = {
  id: string;
  slug?: string | null;
  title: string;
  citySlug?: string;
  dayOfWeek?: string | null;
  date: string;
  meetUpPoint?: string | null;
  meetUpStreetAddress?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
  totalMiles?: number | null;
  pace?: string | null;
  runDescription?: string | null;
  routeDescription?: string | null;
  meetUpNote?: string | null;
  stravaMapUrl?: string | null;
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  instanceType?: string;
  runClub?: {
    slug: string;
    name: string;
    logoUrl: string | null;
    city: string | null;
  } | null;
  runSeries?: {
    id: string;
    slug?: string | null;
    name: string | null;
    dayOfWeek: string;
    description?: string | null;
  } | null;
};

function mapRunSeries(
  series: PublicCityRunPayload['runSeries'],
  citySlug: string | undefined,
): RunSeries | null {
  if (!series) return null;
  return {
    id: series.id,
    name: series.name,
    dayOfWeek: series.dayOfWeek,
    description: series.description ?? null,
    meetUpPoint: null,
    meetUpStreetAddress: null,
    meetUpCity: null,
    meetUpState: null,
    startTimeHour: null,
    startTimeMinute: null,
    startTimePeriod: null,
    citySlug: citySlug ?? null,
  };
}

export function mapPublicRunToCityRunDetails(
  publicRun: PublicCityRunPayload,
  rsvps: CityRunRsvp[] = [],
): CityRunDetails {
  const series = mapRunSeries(publicRun.runSeries, publicRun.citySlug);
  const runSeriesId = series?.id ?? null;

  return {
    id: publicRun.id,
    slug: publicRun.slug ?? null,
    title: publicRun.title,
    citySlug: publicRun.citySlug,
    dayOfWeek: publicRun.dayOfWeek ?? null,
    date: publicRun.date,
    runSeriesId,
    cityRunType: null,
    runSeries: series,
    meetUpPoint: publicRun.meetUpPoint ?? '',
    meetUpStreetAddress: publicRun.meetUpStreetAddress ?? null,
    meetUpCity: publicRun.meetUpCity ?? null,
    meetUpState: publicRun.meetUpState ?? null,
    meetUpLat: publicRun.meetUpLat ?? null,
    meetUpLng: publicRun.meetUpLng ?? null,
    startTimeHour: publicRun.startTimeHour ?? null,
    startTimeMinute: publicRun.startTimeMinute ?? null,
    startTimePeriod: publicRun.startTimePeriod ?? null,
    timezone: publicRun.timezone ?? null,
    totalMiles: publicRun.totalMiles ?? null,
    pace: publicRun.pace ?? null,
    description: publicRun.runDescription ?? null,
    stravaMapUrl: publicRun.stravaMapUrl ?? null,
    routePhotos: publicRun.routePhotos ?? null,
    mapImageUrl: publicRun.mapImageUrl ?? null,
    routeNeighborhood: publicRun.routeNeighborhood ?? null,
    runType: publicRun.runType ?? null,
    workoutDescription: publicRun.routeDescription ?? null,
    meetUpNote: publicRun.meetUpNote ?? null,
    runClub: publicRun.runClub
      ? {
          slug: publicRun.runClub.slug,
          name: publicRun.runClub.name,
          logoUrl: publicRun.runClub.logoUrl,
          city: publicRun.runClub.city,
        }
      : null,
    rsvps,
    currentRSVP: null,
    currentRSVPRole: null,
  };
}
