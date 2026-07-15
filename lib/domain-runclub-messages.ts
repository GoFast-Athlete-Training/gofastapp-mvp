import { prisma } from '@/lib/prisma';
import { sendAppNotification } from '@/lib/app-notifications/send';

export type RunClubMessageAuthor = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
};

export type RunClubMessageRow = {
  id: string;
  runClubId: string;
  athleteId: string;
  content: string;
  linkedRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
  Athlete: RunClubMessageAuthor;
  linkedRun?: {
    id: string;
    title: string;
    date: Date;
    slug: string | null;
  } | null;
  membershipRole?: string | null;
};

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoURL: true,
} as const;

export async function requireActiveClubMembership(runClubId: string, athleteId: string) {
  const membership = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId,
        athleteId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!membership || membership.status !== 'active') {
    return null;
  }

  return membership;
}

export async function listRunClubMessages(runClubId: string): Promise<RunClubMessageRow[]> {
  const messages = await prisma.run_club_messages.findMany({
    where: { runClubId },
    include: {
      Athlete: { select: AUTHOR_SELECT },
      linkedRun: {
        select: {
          id: true,
          title: true,
          date: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  const authorIds = [...new Set(messages.map((m) => m.athleteId))];
  const memberships =
    authorIds.length > 0
      ? await prisma.run_club_memberships.findMany({
          where: {
            runClubId,
            athleteId: { in: authorIds },
            status: 'active',
          },
          select: { athleteId: true, role: true },
        })
      : [];

  const roleByAthlete = new Map(memberships.map((m) => [m.athleteId, m.role]));

  return messages.map((message) => ({
    ...message,
    membershipRole: roleByAthlete.get(message.athleteId) ?? 'member',
  }));
}

export async function postRunClubMessage(params: {
  runClubId: string;
  clubSlug: string;
  clubName: string;
  athleteId: string;
  content: string;
  linkedRunId?: string | null;
}): Promise<RunClubMessageRow> {
  const trimmed = params.content.trim();
  if (!trimmed) {
    throw new Error('Content is required');
  }

  if (params.linkedRunId) {
    const linkedRun = await prisma.city_runs.findFirst({
      where: {
        id: params.linkedRunId,
        runClubId: params.runClubId,
      },
      select: { id: true },
    });
    if (!linkedRun) {
      throw new Error('Linked run not found for this club');
    }
  }

  const message = await prisma.run_club_messages.create({
    data: {
      runClubId: params.runClubId,
      athleteId: params.athleteId,
      content: trimmed,
      linkedRunId: params.linkedRunId?.trim() || null,
    },
    include: {
      Athlete: { select: AUTHOR_SELECT },
      linkedRun: {
        select: {
          id: true,
          title: true,
          date: true,
          slug: true,
        },
      },
    },
  });

  const membership = await requireActiveClubMembership(params.runClubId, params.athleteId);
  const row: RunClubMessageRow = {
    ...message,
    membershipRole: membership?.role ?? 'member',
  };

  void fanoutClubChatterPush({
    runClubId: params.runClubId,
    clubSlug: params.clubSlug,
    clubName: params.clubName,
    authorAthleteId: params.athleteId,
    messageId: message.id,
    content: trimmed,
  });

  return row;
}

async function fanoutClubChatterPush(params: {
  runClubId: string;
  clubSlug: string;
  clubName: string;
  authorAthleteId: string;
  messageId: string;
  content: string;
}) {
  try {
    const members = await prisma.run_club_memberships.findMany({
      where: {
        runClubId: params.runClubId,
        status: 'active',
        athleteId: { not: params.authorAthleteId },
      },
      select: { athleteId: true },
    });

    const excerpt =
      params.content.length > 120 ? `${params.content.slice(0, 117)}...` : params.content;

    await Promise.all(
      members.map((member) =>
        sendAppNotification({
          athleteId: member.athleteId,
          templateKey: 'club.chatter',
          objectType: 'run_club',
          objectId: params.runClubId,
          deeplink: `/chatter/club/${encodeURIComponent(params.clubSlug)}`,
          facts: {
            clubName: params.clubName,
            excerpt,
            messageId: params.messageId,
            clubSlug: params.clubSlug,
          },
          payload: {
            clubSlug: params.clubSlug,
            runClubId: params.runClubId,
            messageId: params.messageId,
          },
        })
      )
    );
  } catch (err) {
    console.error('club chatter push fanout failed:', err);
  }
}
