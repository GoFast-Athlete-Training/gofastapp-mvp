import { prisma } from "@/lib/prisma";
import { isRaceRegistryUuid } from "@/lib/race-hub-urls";
import { serializeHubShakeout } from "@/lib/race-hub-shakeout-utils";
import { CITY_RUN_AFFILIATION_INCLUDE } from "@/lib/city-run/run-affiliations";
import { loadRaceInfoPacketsForStaffView } from "@/lib/races/load-race-info-packets";

const raceSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  raceDate: true,
  city: true,
  state: true,
  distanceLabel: true,
  distanceMeters: true,
  startTime: true,
  courseSlug: true,
} as const;

export type RaceHubStaffSnapshot = {
  race: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    raceDate: string;
    city: string | null;
    state: string | null;
    distanceLabel: string | null;
    distanceMeters: number | null;
    startTime: string | null;
    courseSlug: string | null;
  };
  announcements: unknown[];
  events: unknown[];
  shakeouts: unknown[];
  memberships: unknown[];
  messages: unknown[];
  infoPackets: unknown[];
};

export async function loadRaceHubStaffSnapshotBySlug(
  rawSlug: string
): Promise<RaceHubStaffSnapshot | null> {
  const slug = rawSlug?.trim();
  if (!slug) return null;

  const activeWhere = {
    isActive: true,
    isCancelled: false,
  } as const;

  let race = isRaceRegistryUuid(slug)
    ? await prisma.race_registry.findFirst({
        where: { id: slug, ...activeWhere },
        select: raceSelect,
      })
    : null;

  if (!race) {
    race = await prisma.race_registry.findFirst({
      where: { slug, ...activeWhere },
      select: raceSelect,
    });
  }

  if (!race) {
    race = await prisma.race_registry.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        ...activeWhere,
      },
      select: raceSelect,
    });
  }

  if (!race) return null;

  const raceId = race.id;

  const [announcements, events, runs, memberships, messages, packetResult] = await Promise.all([
    prisma.race_announcements.findMany({
      where: { raceId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    }),
    prisma.race_events.findMany({
      where: { raceId },
      orderBy: { date: "asc" },
      include: {
        organizer: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
        race_event_rsvps: { take: 0 },
      },
    }),
    prisma.city_runs.findMany({
      where: { raceRegistryId: raceId },
      orderBy: { date: "asc" },
      include: {
        city_run_rsvps: {
          include: {
            Athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                gofastHandle: true,
              },
            },
          },
        },
        ...CITY_RUN_AFFILIATION_INCLUDE,
      },
    }),
    prisma.race_memberships.findMany({
      where: { raceId },
      orderBy: { joinedAt: "asc" },
      include: {
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gofastHandle: true,
            photoURL: true,
            bio: true,
          },
        },
      },
    }),
    prisma.race_messages.findMany({
      where: { raceId },
      include: {
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
            gofastHandle: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    loadRaceInfoPacketsForStaffView(raceId),
  ]);

  const shakeouts = runs.map((r) => serializeHubShakeout(r, undefined));

  return {
    race: {
      id: race.id,
      name: race.name,
      slug: race.slug,
      logoUrl: race.logoUrl,
      raceDate: race.raceDate.toISOString(),
      city: race.city,
      state: race.state,
      distanceLabel: race.distanceLabel,
      distanceMeters: race.distanceMeters,
      startTime: race.startTime?.trim() || null,
      courseSlug: race.courseSlug,
    },
    announcements: JSON.parse(JSON.stringify(announcements)),
    events: JSON.parse(JSON.stringify(events)),
    shakeouts: JSON.parse(JSON.stringify(shakeouts)),
    memberships: JSON.parse(JSON.stringify(memberships)),
    messages: JSON.parse(JSON.stringify(messages)),
    infoPackets: packetResult?.packets ?? [],
  };
}
