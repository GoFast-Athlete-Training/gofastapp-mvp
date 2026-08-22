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
  channel_type: ChatterChannelType;
  channel_id: string;
  unread_count: number;
};

type LastMessageRow = {
  channel_type: ChatterChannelType;
  channel_id: string;
  content: string;
  created_at: Date;
  first_name: string | null;
  last_name: string | null;
};

function authorLabel(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Someone';
}

/** Count union branches for tests — one per non-empty channel id list. */
export function countLastMessageUnionBranches(
  clubIds: string[],
  crewIds: string[],
  raceIds: string[]
): number {
  let count = 0;
  if (clubIds.length > 0) count += 1;
  if (crewIds.length > 0) count += 1;
  if (raceIds.length > 0) count += 1;
  return count;
}

export function rowsToLastMessageMap(rows: LastMessageRow[]): Map<string, LastMessageRow> {
  return new Map(rows.map((row) => [`${row.channel_type}:${row.channel_id}`, row]));
}

function buildLastMessageUnionParts(
  clubIds: string[],
  crewIds: string[],
  raceIds: string[]
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];

  if (clubIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT
        'run_club'::text AS channel_type,
        m."runClubId" AS channel_id,
        m.content,
        m."createdAt" AS created_at,
        a."firstName" AS first_name,
        a."lastName" AS last_name
      FROM run_club_messages m
      INNER JOIN "Athlete" a ON a.id = m."athleteId"
      WHERE m."runClubId" IN (${Prisma.join(clubIds)})
    `);
  }

  if (crewIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT
        'run_crew'::text AS channel_type,
        m."runCrewId" AS channel_id,
        m.content,
        m."createdAt" AS created_at,
        a."firstName" AS first_name,
        a."lastName" AS last_name
      FROM run_crew_messages m
      INNER JOIN "Athlete" a ON a.id = m."athleteId"
      WHERE m."runCrewId" IN (${Prisma.join(crewIds)})
    `);
  }

  if (raceIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT
        'race_hub'::text AS channel_type,
        m."raceId" AS channel_id,
        m.content,
        m."createdAt" AS created_at,
        a."firstName" AS first_name,
        a."lastName" AS last_name
      FROM race_messages m
      INNER JOIN "Athlete" a ON a.id = m."athleteId"
      WHERE m."raceId" IN (${Prisma.join(raceIds)})
    `);
  }

  return parts;
}

/**
 * Neon pooler + Prisma serverless uses connection_limit=1. Never fan out parallel
 * Prisma calls in one request — they contend for the single pool slot (P2024).
 */
async function batchUnreadCounts(
  athleteId: string,
  clubIds: string[],
  crewIds: string[],
  raceIds: string[]
): Promise<{
  club: Map<string, number>;
  crew: Map<string, number>;
  race: Map<string, number>;
}> {
  const parts: Prisma.Sql[] = [];

  if (clubIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT 'run_club'::text AS channel_type,
             m."runClubId" AS channel_id,
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
  }

  if (crewIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT 'run_crew'::text AS channel_type,
             m."runCrewId" AS channel_id,
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
  }

  if (raceIds.length > 0) {
    parts.push(Prisma.sql`
      SELECT 'race_hub'::text AS channel_type,
             m."raceId" AS channel_id,
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
  }

  if (parts.length === 0) {
    return { club: new Map(), crew: new Map(), race: new Map() };
  }

  const rows = await prisma.$queryRaw<UnreadCountRow[]>(
    Prisma.join(parts, ' UNION ALL ')
  );

  const club = new Map<string, number>();
  const crew = new Map<string, number>();
  const race = new Map<string, number>();

  for (const row of rows) {
    if (row.channel_type === 'run_club') club.set(row.channel_id, row.unread_count);
    if (row.channel_type === 'run_crew') crew.set(row.channel_id, row.unread_count);
    if (row.channel_type === 'race_hub') race.set(row.channel_id, row.unread_count);
  }

  return { club, crew, race };
}

async function batchLastMessages(
  clubIds: string[],
  crewIds: string[],
  raceIds: string[]
): Promise<Map<string, LastMessageRow>> {
  const parts = buildLastMessageUnionParts(clubIds, crewIds, raceIds);
  if (parts.length === 0) return new Map();

  const union =
    parts.length === 1 ? parts[0]! : Prisma.join(parts, Prisma.sql` UNION ALL `);

  const rows = await prisma.$queryRaw<LastMessageRow[]>(Prisma.sql`
    SELECT DISTINCT ON (channel_type, channel_id)
      channel_type,
      channel_id,
      content,
      created_at,
      first_name,
      last_name
    FROM (${union}) AS combined
    ORDER BY channel_type, channel_id, created_at DESC
  `);

  return rowsToLastMessageMap(rows);
}

export async function listChatterChannelsForAthlete(athleteId: string): Promise<ChatterChannelRow[]> {
  const clubMemberships = await prisma.run_club_memberships.findMany({
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
  });

  const crewMemberships = await prisma.run_crew_memberships.findMany({
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
  });

  const raceMemberships = await prisma.race_memberships.findMany({
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
  });

  const clubIds = clubMemberships.map((membership) => membership.run_clubs.id);
  const crewIds = crewMemberships.map((membership) => membership.run_crews.id);
  const raceIds = raceMemberships.map((membership) => membership.race_registry.id);

  const lastMessageMap = await batchLastMessages(clubIds, crewIds, raceIds);
  const unread = await batchUnreadCounts(athleteId, clubIds, crewIds, raceIds);

  const channels: ChatterChannelRow[] = [];

  for (const membership of clubMemberships) {
    const club = membership.run_clubs;
    const lastMessage = lastMessageMap.get(`run_club:${club.id}`);

    channels.push({
      type: 'run_club',
      id: club.id,
      slug: club.slug,
      name: club.name,
      logoUrl: club.logoUrl,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.created_at.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.first_name, lastMessage.last_name)
        : null,
      unreadCount: unread.club.get(club.id) ?? 0,
      viewerRole: membership.role,
    });
  }

  for (const membership of crewMemberships) {
    const crew = membership.run_crews;
    const lastMessage = lastMessageMap.get(`run_crew:${crew.id}`);

    channels.push({
      type: 'run_crew',
      id: crew.id,
      slug: crew.handle ?? null,
      name: crew.name,
      logoUrl: crew.logo,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.created_at.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.first_name, lastMessage.last_name)
        : null,
      unreadCount: unread.crew.get(crew.id) ?? 0,
      viewerRole: membership.role,
    });
  }

  for (const membership of raceMemberships) {
    const race = membership.race_registry;
    const lastMessage = lastMessageMap.get(`race_hub:${race.id}`);

    channels.push({
      type: 'race_hub',
      id: race.id,
      slug: race.slug,
      name: race.name,
      logoUrl: race.logoUrl,
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.created_at.toISOString() ?? null,
      lastAuthorName: lastMessage
        ? authorLabel(lastMessage.first_name, lastMessage.last_name)
        : null,
      unreadCount: unread.race.get(race.id) ?? 0,
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
