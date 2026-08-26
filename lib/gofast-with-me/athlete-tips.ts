import { prisma } from '@/lib/prisma';

export type AthleteTipVisibility = 'draft' | 'published';
export type AthleteTipMediaType = 'image' | 'video';
export type AthleteTipSurface = 'landing' | 'feed';

export type AthleteTipPayload = {
  id: string;
  title: string;
  body: string;
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
  sortOrder: number;
  visibility: AthleteTipVisibility;
  showOnLanding: boolean;
  showOnFeed: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AthleteTipRow = {
  id: string;
  title: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  sortOrder: number;
  isPublished: boolean;
  showOnLanding: boolean;
  showOnFeed: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeMediaType(value: unknown): AthleteTipMediaType | null {
  if (value === 'image' || value === 'video') return value;
  return null;
}

export function mapAthleteTip(row: AthleteTipRow): AthleteTipPayload {
  const mediaUrl = row.mediaUrl?.trim() || null;
  const mediaType = normalizeMediaType(row.mediaType);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mediaUrl,
    mediaType: mediaUrl ? mediaType : null,
    sortOrder: row.sortOrder,
    visibility: row.isPublished ? 'published' : 'draft',
    showOnLanding: row.showOnLanding,
    showOnFeed: row.showOnFeed,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAthleteTipsForOwner(athleteId: string): Promise<AthleteTipPayload[]> {
  const rows = await prisma.athlete_tips.findMany({
    where: { athleteId },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  });
  return rows.map(mapAthleteTip);
}

export async function listPublishedAthleteTips(
  athleteId: string,
  limit = 6,
  surface?: AthleteTipSurface
): Promise<AthleteTipPayload[]> {
  const rows = await prisma.athlete_tips.findMany({
    where: {
      athleteId,
      isPublished: true,
      ...(surface === 'landing' ? { showOnLanding: true } : {}),
      ...(surface === 'feed' ? { showOnFeed: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });
  return rows.map(mapAthleteTip);
}

export function normalizeTipInput(input: unknown): {
  title: string;
  body: string;
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
  sortOrder: number;
  showOnLanding: boolean;
  showOnFeed: boolean;
  isPublished: boolean;
} {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const title = String(value.title ?? '').trim();
  const body = String(value.body ?? '').trim();
  const sortOrderRaw = Number(value.sortOrder ?? 0);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  const legacyPublished = Boolean(value.isPublished ?? value.visibility === 'published');
  const showOnLanding =
    value.showOnLanding !== undefined ? Boolean(value.showOnLanding) : legacyPublished;
  const showOnFeed = value.showOnFeed !== undefined ? Boolean(value.showOnFeed) : legacyPublished;
  const isPublished = showOnLanding || showOnFeed;

  const mediaUrlRaw =
    value.mediaUrl === null || value.mediaUrl === undefined
      ? null
      : String(value.mediaUrl).trim() || null;
  const mediaTypeRaw = normalizeMediaType(value.mediaType);

  let mediaUrl: string | null = mediaUrlRaw;
  let mediaType: AthleteTipMediaType | null = mediaTypeRaw;

  if (!mediaUrl) {
    mediaUrl = null;
    mediaType = null;
  } else if (!mediaType) {
    mediaType = 'image';
  }

  return { title, body, mediaUrl, mediaType, sortOrder, showOnLanding, showOnFeed, isPublished };
}
