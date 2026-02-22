import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('Starting CityRun -> CityRunEvent backfill...');

  const runs = await prisma.city_runs.findMany({
    select: {
      id: true,
      startDate: true,
      timezone: true,
      meetUpPoint: true,
      meetUpPlaceId: true,
      meetUpLat: true,
      meetUpLng: true,
      totalMiles: true,
      pace: true,
      stravaMapUrl: true,
      description: true,
      postRunActivity: true,
      routePhotos: true,
      mapImageUrl: true,
      staffNotes: true,
      stravaUrl: true,
      stravaText: true,
      webUrl: true,
      webText: true,
      igPostText: true,
      igPostGraphic: true,
      createdAt: true,
      updatedAt: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      slug: true,
      workflowStatus: true,
      endPoint: true,
      meetUpStreetAddress: true,
      meetUpCity: true,
      meetUpState: true,
      meetUpZip: true,
      routeNeighborhood: true,
      runType: true,
      workoutDescription: true,
      endStreetAddress: true,
      endCity: true,
      endState: true,
    },
  });

  let createdEvents = 0;
  for (const run of runs) {
    await prisma.city_run_events.upsert({
      where: { id: run.id },
      update: {},
      create: {
        id: run.id,
        cityRunId: run.id,
        eventDate: run.startDate,
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
        routePhotos: run.routePhotos ?? Prisma.JsonNull,
        mapImageUrl: run.mapImageUrl,
        staffNotes: run.staffNotes,
        stravaUrl: run.stravaUrl,
        stravaText: run.stravaText,
        webUrl: run.webUrl,
        webText: run.webText,
        igPostText: run.igPostText,
        igPostGraphic: run.igPostGraphic,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        slug: run.slug,
        workflowStatus: run.workflowStatus,
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
    createdEvents += 1;
  }

  const legacyRsvps = await prisma.city_run_rsvps.findMany();
  let createdEventRsvps = 0;
  for (const rsvp of legacyRsvps) {
    await prisma.city_run_event_rsvps.upsert({
      where: {
        cityRunEventId_athleteId: {
          cityRunEventId: rsvp.runId,
          athleteId: rsvp.athleteId,
        },
      },
      update: {
        status: rsvp.status,
        checkedInAt: rsvp.checkedInAt,
        rsvpPhotoUrls: rsvp.rsvpPhotoUrls ?? Prisma.JsonNull,
      },
      create: {
        id: rsvp.id,
        cityRunEventId: rsvp.runId,
        athleteId: rsvp.athleteId,
        status: rsvp.status,
        checkedInAt: rsvp.checkedInAt,
        rsvpPhotoUrls: rsvp.rsvpPhotoUrls ?? Prisma.JsonNull,
        createdAt: rsvp.createdAt,
      },
    });
    createdEventRsvps += 1;
  }

  console.log(`Backfill complete. Events processed: ${createdEvents}, RSVP rows processed: ${createdEventRsvps}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
