import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ChatterChannelType = 'run_club' | 'run_crew' | 'race_hub';

export type ChatterChannelRow = {
  type: ChatterChannelType;
  id: string;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastAuthorName: string | null;
  unreadCount: number;
  viewerRole: string | null;
};

type UnreadCountRow = {
  channel_id: string;
  unread_count: number;
};

function authorLabel(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Someone';
}

async function batchRunClubUnreadCounts(
  athleteId: string,
  clubIds: string[]
): Promise<Map<string, number>> {
  if (clubIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<UnreadCountRow[]>(Prisma.sql`
    SELECT m."runClubId" AS channel_id,
           COUNT(*)::int AS unread_count
    FROM run_club_messages m
    LEFT JOIN chatter_channel_reads r
      ON r."channelId" = m."runClubId"
      AND r."channelType" = 'run_club'
      AND r."athleteId" = ${athleteId}
    WHERE m."runClubId" IN (${Prisma.join(clubIds)})
      AND m."athleteId" <> ${athleteId}
      AND m."createdAt" > COALESCE(r."lastReadAt", TIMESTAMP '1970-01-01')
    GROUP BY m."runClubId"
  `);

  return new Map(rows.map((row) => [row.channel_id, row.unread_count]));
}

async function batchRunCrewUnreadCounts(
  athleteId: string,
  crewIds: string[]
): Promise<Map<string, number>> {
  if (crewIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<UnreadCountRow[]>(Prisma.sql`
    SELECT m."runCrewId" AS channel_id,
           COUNT(*)::int AS unread_count
    FROM run_crew_messages m
    LEFT JOIN chatter_channel_reads r
      ON r."channelId" = m."runCrewId"
      AND r."channelType" = 'run_crew'
      AND r."athleteId" = ${athleteId}
    WHERE m."runCrewId" IN (${Prisma.join(crewIds)})
      AND m."athleteId" <> ${athleteId}
      AND m."createdAt" > COALESCE(r."lastReadAt", TIMESTAMP '1970-01-01')
    GROUP BY m."runCrewId"
  `);

  return new Map(rows.map((row) => [row.channel_id, row.unread_count]));
}

async function batchRaceHubUnreadCounts(
  athleteId: string,
  raceIds: string[]
): Promise<Map<string, number>> {
  if (raceIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<UnreadCountRow[]>(Prisma.sql`
    SELECT m."raceId" AS channel_id,
           COUNT(*)::int AS unread_count
    FROM race_messages m
    LEFT JOIN chatter_channel_reads r
      ON r."channelId" = m."raceId"
      AND r."channelType" = 'race_hub'
      AND r."athleteId" = ${athleteId}
    WHERE m."raceId" IN (${Prisma.join(raceIds)})
      AND m."athleteId" <> ${athleteId}
      AND m."createdAt" > COALESCE(r."lastReadAt", TIMESTAMP '1970-01-01')
    GROUP BY m."raceId"
  `);

  return new Map(rows.map((row) => [row.channel_id, row.unread_count]));
}

export async function listChatterChannelsForAthlete(athleteId: string): Promise<ChatterChannelRow[]> {
  const [clubMemberships, crewMemberships, raceMemberships] = await Promise.all([
    prisma.run_club_memberships.findMany({
      where: { athleteId, status: 'active' },
      include: {
        run_clubs: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    }),
    prisma.run_crew_memberships.findMany({
      where: { athleteId },
      include: {
        run_crews: {
          select: {
            id: true,
            name: true,
            logo: true,
            handle: true,
          },
        },
      },
    }),
    prisma.race_memberships.findMany({
      where: { athleteId },
      include: {
        race_registry: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    }),
  ]);

  const clubIds = clubMemberships.map((membership) => membership.run_clubs.id);
  const crewIds = crewMemberships.map((membership) => membership.run_crews.id);
  const raceIds = raceMemberships.map((membership) => membership.race_registry.id);

  const [
    clubLastMessages,
    crewLastMessages,
    raceLastMessages,
    clubUnread,
    crewUnread,
    raceUnread,
  ] = await Promise.all([
    clubIds.length
      ? prisma.run_club_messages.findMany({
          where: { runClubId: { in: clubIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['runClubId'],
          include: {
            Athlete: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    crewIds.length
      ? prisma.run_crew_messages.findMany({
          where: { runCrewId: { in: crewIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['runCrewId'],
          include: {
            Athlete: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    raceIds.length
      ? prisma.race_messages.findMany({
          where: { raceId: { in: raceIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['raceId'],
          include: {
            Athlete: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    batchRunClubUnreadCounts(athleteId, clubIds),
    batchRunCrewUnreadCounts(athleteId, crewIds),
    batchRaceHubUnreadCounts(athleteId, raceIds),
  ]);

  const clubLastMap = new Map(clubLastMessages.map((message) => [message.runClubId, message]));
  const crewLastMap = new Map(crewLastMessages.map((message) => [message.runCrewId, message]));
  const raceLastMap = new Map(raceLastMessages.map((message) => [message.raceId, message]));

  const channels: ChatterChannelRow[] = [];

  for (const membership of clubMemberships) {
    const club = membership.run_clubs;
    const lastMessage = clubLastMap.get(club.id);

    channels.push({
      type: 'run_club',
      id: club.id,
      slug: club.slug,
      name: club.name,
      logoUrl: club.logoUrl,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.Athlete.firstName, lastMessage.Athlete.lastName)
        : null,
      unreadCount: clubUnread.get(club.id) ?? 0,
      viewerRole: membership.role,
    });
  }

  for (const membership of crewMemberships) {
    const crew = membership.run_crews;
    const lastMessage = crewLastMap.get(crew.id);

    channels.push({
      type: 'run_crew',
      id: crew.id,
      slug: crew.handle ?? null,
      name: crew.name,
      logoUrl: crew.logo,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.Athlete.firstName, lastMessage.Athlete.lastName)
        : null,
      unreadCount: crewUnread.get(crew.id) ?? 0,
      viewerRole: membership.role,
    });
  }

  for (const membership of raceMemberships) {
    const race = membership.race_registry;
    const lastMessage = raceLastMap.get(race.id);

    channels.push({
      type: 'race_hub',
      id: race.id,
      slug: race.slug,
      name: race.name,
      logoUrl: race.logoUrl,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.Athlete.firstName, lastMessage.Athlete.lastName)
        : null,
      unreadCount: raceUnread.get(race.id) ?? 0,
      viewerRole: membership.role,
    });
  }

  channels.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  return channels;
}

export async function markChatterChannelRead(params: {
  athleteId: string;
  channelType: ChatterChannelType;
  channelId: string;
}) {
  return prisma.chatter_channel_reads.upsert({
    where: {
      athleteId_channelType_channelId: {
        athleteId: params.athleteId,
        channelType: params.channelType,
        channelId: params.channelId,
      },
    },
    create: {
      athleteId: params.athleteId,
      channelType: params.channelType,
      channelId: params.channelId,
      lastReadAt: new Date(),
    },
    update: {
      lastReadAt: new Date(),
    },
  });
}

export async function totalChatterUnread(athleteId: string): Promise<number> {
  const channels = await listChatterChannelsForAthlete(athleteId);
  return channels.reduce((sum, channel) => sum + channel.unreadCount, 0);
}
