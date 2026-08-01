import { prisma } from '@/lib/prisma';

export type AthleteTipVisibility = 'draft' | 'published';

export type AthleteTipPayload = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  visibility: AthleteTipVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AthleteTipRow = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapAthleteTip(row: AthleteTipRow): AthleteTipPayload {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    visibility: row.isPublished ? 'published' : 'draft',
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
  limit = 6
): Promise<AthleteTipPayload[]> {
  const rows = await prisma.athlete_tips.findMany({
    where: { athleteId, isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });
  return rows.map(mapAthleteTip);
}

export function normalizeTipInput(input: unknown): {
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
} {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const title = String(value.title ?? '').trim();
  const body = String(value.body ?? '').trim();
  const sortOrderRaw = Number(value.sortOrder ?? 0);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;
  const isPublished = Boolean(value.isPublished ?? value.visibility === 'published');

  return { title, body, sortOrder, isPublished };
}
