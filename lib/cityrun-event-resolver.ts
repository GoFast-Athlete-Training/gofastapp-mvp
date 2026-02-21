import { prisma } from '@/lib/prisma';

function isMissingTable(error: any) {
  return error?.code === 'P2021' || (typeof error?.message === 'string' && error.message.includes('city_run_events'));
}

async function ensureEventForLegacyRun(run: any) {
  const existing = await prisma.city_run_events.findUnique({
    where: { id: run.id },
  });
  if (existing) return existing;

  return prisma.city_run_events.create({
    data: {
      id: run.id,
      cityRunId: run.id,
      eventDate: run.startDate ?? run.date,
      timezone: run.timezone,
      meetUpPoint: run.meetUpPoint,
      meetUpPlaceId: run.meetUpPlaceId,
      meetUpLat: run.meetUpLat,
      meetUpLng: run.meetUpLng,
      totalMiles: run.totalMiles,
      pace: run.pace,
      stravaMapUrl: run.stravaMapUrl,
      description: run.description,
      postRunActivity: run.postRunActivity,
      routePhotos: run.routePhotos ?? null,
      mapImageUrl: run.mapImageUrl,
      staffNotes: run.staffNotes,
      stravaUrl: run.stravaUrl,
      stravaText: run.stravaText,
      webUrl: run.webUrl,
      webText: run.webText,
      igPostText: run.igPostText,
      igPostGraphic: run.igPostGraphic,
      createdAt: run.createdAt ?? new Date(),
      updatedAt: new Date(),
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod,
      slug: run.slug,
      workflowStatus: run.workflowStatus ?? 'DEVELOP',
      endPoint: run.endPoint,
      meetUpStreetAddress: run.meetUpStreetAddress,
      meetUpCity: run.meetUpCity,
      meetUpState: run.meetUpState,
      meetUpZip: run.meetUpZip,
      routeNeighborhood: run.routeNeighborhood,
      runType: run.runType,
      workoutDescription: run.workoutDescription,
      endStreetAddress: run.endStreetAddress,
      endCity: run.endCity,
      endState: run.endState,
      generationSource: 'MIGRATED',
    },
  });
}

/**
 * Resolve an incoming legacy run identifier or slug to a CityRunEvent.
 * Returns null if nothing can be resolved.
 */
export async function resolveCityRunEvent(identifier: string) {
  const segment = (identifier || '').trim();
  if (!segment) return null;

  try {
    const include = {
      city_runs: {
        include: {
          runClub: {
            select: {
              id: true,
              slug: true,
              name: true,
              logoUrl: true,
              city: true,
            },
          },
        },
      },
    } as const;

    let event = await prisma.city_run_events.findUnique({
      where: { id: segment },
      include,
    });
    if (event) return event;

    event = await prisma.city_run_events.findUnique({
      where: { slug: segment },
      include,
    });
    if (event) return event;

    let legacyRun = await prisma.city_runs.findUnique({
      where: { id: segment },
    });
    if (!legacyRun) {
      legacyRun = await prisma.city_runs.findUnique({
        where: { slug: segment },
      });
    }
    if (!legacyRun) return null;

    const now = new Date();
    event = await prisma.city_run_events.findFirst({
      where: {
        cityRunId: legacyRun.id,
        eventDate: { gte: now },
        isCancelled: false,
      },
      orderBy: { eventDate: 'asc' },
      include,
    });
    if (event) return event;

    event = await prisma.city_run_events.findFirst({
      where: { cityRunId: legacyRun.id },
      orderBy: { eventDate: 'desc' },
      include,
    });
    if (event) return event;

    const created = await ensureEventForLegacyRun(legacyRun);
    return prisma.city_run_events.findUnique({
      where: { id: created.id },
      include,
    });
  } catch (error: any) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function resolveCityRunEventId(identifier: string): Promise<string | null> {
  const event = await resolveCityRunEvent(identifier);
  return event?.id ?? null;
}
