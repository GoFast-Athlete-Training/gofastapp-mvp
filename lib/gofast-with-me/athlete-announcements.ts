import { prisma } from '@/lib/prisma';

export type AthleteAnnouncementPayload = {
  id: string;
  title: string | null;
  body: string;
  publishedAt: string;
  author: {
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  };
};

const announcementInclude = {
  author: {
    select: {
      firstName: true,
      lastName: true,
      photoURL: true,
    },
  },
} as const;

function mapAnnouncement(row: {
  id: string;
  title: string | null;
  body: string;
  publishedAt: Date;
  author: {
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  };
}): AthleteAnnouncementPayload {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt.toISOString(),
    author: row.author,
  };
}

export async function listAthleteAnnouncements(
  hostAthleteId: string,
  limit = 20
): Promise<AthleteAnnouncementPayload[]> {
  const rows = await prisma.gofast_athlete_announcements.findMany({
    where: { hostAthleteId },
    orderBy: { publishedAt: 'desc' },
    take: Math.min(50, Math.max(1, limit)),
    include: announcementInclude,
  });
  return rows.map(mapAnnouncement);
}

export async function createAthleteAnnouncement(input: {
  hostAthleteId: string;
  authorId: string;
  title?: string | null;
  body: string;
}): Promise<AthleteAnnouncementPayload> {
  const body = input.body.trim();
  if (!body) throw new Error('Announcement body is required');
  if (input.hostAthleteId !== input.authorId) {
    throw new Error('Only the host can post announcements');
  }

  const created = await prisma.gofast_athlete_announcements.create({
    data: {
      hostAthleteId: input.hostAthleteId,
      authorId: input.authorId,
      title: input.title?.trim() || null,
      body,
    },
    include: announcementInclude,
  });
  return mapAnnouncement(created);
}

export async function deleteAthleteAnnouncement(
  announcementId: string,
  hostAthleteId: string
): Promise<boolean> {
  const existing = await prisma.gofast_athlete_announcements.findFirst({
    where: { id: announcementId, hostAthleteId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.gofast_athlete_announcements.delete({ where: { id: announcementId } });
  return true;
}
