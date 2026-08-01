import { prisma } from '@/lib/prisma';

export type AthleteInstagramMediaPayload = {
  id: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
  timestamp: string | null;
};

type InstagramMediaRow = {
  id: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
  timestamp: Date | null;
};

export function mapInstagramMedia(row: InstagramMediaRow): AthleteInstagramMediaPayload {
  return {
    id: row.id,
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    permalink: row.permalink,
    caption: row.caption,
    timestamp: row.timestamp?.toISOString() ?? null,
  };
}

export async function listPublicInstagramMedia(
  athleteId: string,
  limit = 5
): Promise<AthleteInstagramMediaPayload[]> {
  const rows = await prisma.athlete_instagram_media.findMany({
    where: { athleteId },
    orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      mediaType: true,
      mediaUrl: true,
      thumbnailUrl: true,
      permalink: true,
      caption: true,
      timestamp: true,
    },
  });
  return rows.map(mapInstagramMedia);
}
