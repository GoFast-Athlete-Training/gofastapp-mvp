import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type AthleteTipVisibility = 'draft' | 'published';
export type AthleteTipMediaType = 'image' | 'video';
export type AthleteTipSurface = 'landing' | 'feed';

export type AthleteTipSeriesItem = {
  title: string;
  body: string;
};

export type AthleteTipSeries = {
  title?: string | null;
  tips: AthleteTipSeriesItem[];
};

export type AthleteTipPayload = {
  id: string;
  title: string;
  /** The Big Idea — canonical long-form content. */
  body: string;
  /** Alias for body in product-facing APIs. */
  bigIdea: string;
  takeaway: string | null;
  tipSeries: AthleteTipSeries | null;
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
  takeaway?: string | null;
  tipSeries?: unknown;
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

const MAX_TAKEAWAY = 2000;
const MAX_SERIES_ITEMS = 20;
const MAX_SERIES_ITEM_TITLE = 120;
const MAX_SERIES_ITEM_BODY = 4000;
const MAX_SERIES_TITLE = 120;

function normalizeMediaType(value: unknown): AthleteTipMediaType | null {
  if (value === 'image' || value === 'video') return value;
  return null;
}

function normalizeTipSeries(value: unknown): AthleteTipSeries | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const tipsRaw = raw.tips;
  if (!Array.isArray(tipsRaw)) return null;

  const tips: AthleteTipSeriesItem[] = [];
  for (const item of tipsRaw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    const body = String(row.body ?? '').trim();
    if (!title && !body) continue;
    if (title.length > MAX_SERIES_ITEM_TITLE) {
      throw new Error(`Series item title too long (max ${MAX_SERIES_ITEM_TITLE})`);
    }
    if (body.length > MAX_SERIES_ITEM_BODY) {
      throw new Error(`Series item body too long (max ${MAX_SERIES_ITEM_BODY})`);
    }
    tips.push({ title, body });
    if (tips.length > MAX_SERIES_ITEMS) {
      throw new Error(`Too many series items (max ${MAX_SERIES_ITEMS})`);
    }
  }

  const seriesTitleRaw = raw.title;
  const seriesTitle =
    seriesTitleRaw === null || seriesTitleRaw === undefined
      ? null
      : String(seriesTitleRaw).trim() || null;
  if (seriesTitle && seriesTitle.length > MAX_SERIES_TITLE) {
    throw new Error(`Series title too long (max ${MAX_SERIES_TITLE})`);
  }

  if (tips.length === 0 && !seriesTitle) return null;
  return { title: seriesTitle, tips };
}

export function mapAthleteTip(row: AthleteTipRow): AthleteTipPayload {
  const mediaUrl = row.mediaUrl?.trim() || null;
  const mediaType = normalizeMediaType(row.mediaType);
  const takeaway = row.takeaway?.trim() || null;
  let tipSeries: AthleteTipSeries | null = null;
  try {
    tipSeries = normalizeTipSeries(row.tipSeries);
  } catch {
    tipSeries = null;
  }

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    bigIdea: row.body,
    takeaway,
    tipSeries,
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
  takeaway: string | null;
  tipSeries: AthleteTipSeries | null;
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
  sortOrder: number;
  showOnLanding: boolean;
  showOnFeed: boolean;
  isPublished: boolean;
} {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const title = String(value.title ?? '').trim();
  const bodyRaw = value.bigIdea ?? value.body;
  const body = String(bodyRaw ?? '').trim();
  const takeawayRaw =
    value.takeaway === null || value.takeaway === undefined
      ? null
      : String(value.takeaway).trim() || null;
  if (takeawayRaw && takeawayRaw.length > MAX_TAKEAWAY) {
    throw new Error(`Takeaway too long (max ${MAX_TAKEAWAY})`);
  }

  const tipSeries = normalizeTipSeries(value.tipSeries);

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

  return {
    title,
    body,
    takeaway: takeawayRaw,
    tipSeries,
    mediaUrl,
    mediaType,
    sortOrder,
    showOnLanding,
    showOnFeed,
    isPublished,
  };
}

export function tipSeriesToJson(series: AthleteTipSeries): Prisma.InputJsonValue {
  return {
    title: series.title ?? null,
    tips: series.tips.map((item) => ({ title: item.title, body: item.body })),
  };
}
