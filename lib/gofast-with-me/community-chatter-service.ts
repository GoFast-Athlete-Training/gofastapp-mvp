import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import { canAccessGfwmHostContent } from '@/lib/gofast-container-access';
import {
  containerMessageInclude,
  mapContainerMessageRow,
} from '@/lib/gofast-with-me/container-message-map';
import { resolveAthleteByPublicHandle, normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-service';

const MAX_BODY = 2000;
const DEFAULT_LIMIT = 40;

export async function resolveHostByPublicHandle(rawHandle: string) {
  const slug = normalizeGoFastWithMeSlug(rawHandle);
  if (!slug) return null;
  const athlete = await resolveAthleteByPublicHandle(slug);
  if (!athlete?.gofastHandle?.trim()) return null;
  return athlete;
}

export async function listCommunityChatterMessages(
  hostAthleteId: string,
  options?: { cursor?: string | null; limit?: number }
) {
  const take = Math.min(50, Math.max(1, options?.limit ?? DEFAULT_LIMIT));
  const cursor = options?.cursor?.trim() || undefined;

  const rows = await prisma.gofast_container_messages.findMany({
    where: {
      containerAthleteId: hostAthleteId,
      topic: 'chatter',
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: containerMessageInclude,
  });

  let nextCursor: string | null = null;
  let list = rows;
  if (rows.length > take) {
    const extra = rows.pop();
    nextCursor = extra?.id ?? null;
    list = rows;
  }

  return {
    messages: list.map(mapContainerMessageRow),
    nextCursor,
  };
}

export async function postCommunityChatterMessage(
  hostAthleteId: string,
  authorAthleteId: string,
  body: string
) {
  const text = body.trim();
  if (!text) throw new Error('Message body required');
  if (text.length > MAX_BODY) throw new Error(`Message too long (max ${MAX_BODY})`);

  const ok = await canAccessGfwmHostContent(hostAthleteId, authorAthleteId);
  if (!ok) throw new Error('Forbidden');

  const created = await prisma.gofast_container_messages.create({
    data: {
      containerAthleteId: hostAthleteId,
      authorAthleteId,
      body: text,
      topic: 'chatter',
    },
    include: containerMessageInclude,
  });

  return mapContainerMessageRow(created);
}

export async function deleteCommunityChatterMessage(
  hostAthleteId: string,
  messageId: string,
  callerAthleteId: string
) {
  if (callerAthleteId !== hostAthleteId) {
    throw new Error('Forbidden');
  }

  const existing = await prisma.gofast_container_messages.findFirst({
    where: { id: messageId, containerAthleteId: hostAthleteId, topic: 'chatter' },
    select: { id: true },
  });
  if (!existing) throw new Error('Not found');

  await prisma.gofast_container_messages.delete({ where: { id: messageId } });
}

export async function assertHostExists(hostAthleteId: string) {
  const host = await getAthleteById(hostAthleteId);
  if (!host) return null;
  return host;
}
