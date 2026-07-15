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

function authorLabel(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Someone';
}

export async function listChatterChannelsForAthlete(athleteId: string): Promise<ChatterChannelRow[]> {
  const [clubMemberships, crewMemberships, raceMemberships, readCursors] = await Promise.all([
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
    prisma.chatter_channel_reads.findMany({
      where: { athleteId },
      select: {
        channelType: true,
        channelId: true,
        lastReadAt: true,
      },
    }),
  ]);

  const readMap = new Map(
    readCursors.map((row) => [`${row.channelType}:${row.channelId}`, row.lastReadAt])
  );

  const channels: ChatterChannelRow[] = [];

  for (const membership of clubMemberships) {
    const club = membership.run_clubs;
    const lastMessage = await prisma.run_club_messages.findFirst({
      where: { runClubId: club.id },
      orderBy: { createdAt: 'desc' },
      include: {
        Athlete: { select: { firstName: true, lastName: true } },
      },
    });

    const lastReadAt = readMap.get(`run_club:${club.id}`);
    const unreadCount = lastMessage
      ? await prisma.run_club_messages.count({
          where: {
            runClubId: club.id,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            athleteId: { not: athleteId },
          },
        })
      : 0;

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
      unreadCount,
      viewerRole: membership.role,
    });
  }

  for (const membership of crewMemberships) {
    const crew = membership.run_crews;
    const lastMessage = await prisma.run_crew_messages.findFirst({
      where: { runCrewId: crew.id },
      orderBy: { createdAt: 'desc' },
      include: {
        Athlete: { select: { firstName: true, lastName: true } },
      },
    });

    const lastReadAt = readMap.get(`run_crew:${crew.id}`);
    const unreadCount = lastMessage
      ? await prisma.run_crew_messages.count({
          where: {
            runCrewId: crew.id,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            athleteId: { not: athleteId },
          },
        })
      : 0;

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
      unreadCount,
      viewerRole: membership.role,
    });
  }

  for (const membership of raceMemberships) {
    const race = membership.race_registry;
    const lastMessage = await prisma.race_messages.findFirst({
      where: { raceId: race.id },
      orderBy: { createdAt: 'desc' },
      include: {
        Athlete: { select: { firstName: true, lastName: true } },
      },
    });

    const lastReadAt = readMap.get(`race_hub:${race.id}`);
    const unreadCount = lastMessage
      ? await prisma.race_messages.count({
          where: {
            raceId: race.id,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            athleteId: { not: athleteId },
          },
        })
      : 0;

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
      unreadCount,
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
