import { prisma } from '@/lib/prisma';
import {
  activityPostInclude,
  mapOwnerActivityPost,
  mapPublishedActivityPost,
  type ActivityPostOwnerPayload,
  type ActivityPostPayload,
} from '@/lib/gofast-with-me/activity-posts';

export type TrainingReflectionOwnerPayload = ActivityPostOwnerPayload;

export type TrainingReflectionPublicPayload = ActivityPostPayload;

const MAX_CAPTION = 8000;

export async function listTrainingReflectionsForOwner(
  athleteId: string,
  limit = 50
): Promise<TrainingReflectionOwnerPayload[]> {
  const rows = await prisma.athlete_activity_posts.findMany({
    where: { athleteId },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
    include: activityPostInclude,
  });
  return rows.map((row) => mapOwnerActivityPost(row));
}

export async function listPublishedTrainingReflections(
  athleteId: string,
  limit = 24
): Promise<TrainingReflectionPublicPayload[]> {
  const rows = await prisma.athlete_activity_posts.findMany({
    where: { athleteId, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: activityPostInclude,
  });
  return rows
    .map((row) => mapPublishedActivityPost(row))
    .filter((post): post is TrainingReflectionPublicPayload => post != null);
}

export function normalizeTrainingReflectionInput(input: unknown): {
  caption: string | null;
  photoUrl: string | null;
  activityId: string | null;
  showMatchedWorkout: boolean;
  publish: boolean;
} {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const activityIdRaw =
    typeof body.activityId === 'string' ? body.activityId.trim() : '';
  const activityId = activityIdRaw.length > 0 ? activityIdRaw : null;
  const captionRaw = typeof body.caption === 'string' ? body.caption.trim() : '';
  const caption = captionRaw.length > 0 ? captionRaw.slice(0, MAX_CAPTION) : null;
  const photoUrl =
    typeof body.photoUrl === 'string' && body.photoUrl.trim() ? body.photoUrl.trim() : null;
  const showMatchedWorkout = body.showMatchedWorkout !== false;
  const publish = body.publish === true;
  return { caption, photoUrl, activityId, showMatchedWorkout, publish };
}

export function validateTrainingReflectionInput(
  input: ReturnType<typeof normalizeTrainingReflectionInput>
): string | null {
  if (!input.caption && !input.photoUrl) {
    return 'Add reflection text or a photo';
  }
  return null;
}

export async function createTrainingReflection(
  athleteId: string,
  input: ReturnType<typeof normalizeTrainingReflectionInput>
): Promise<TrainingReflectionOwnerPayload> {
  if (input.activityId) {
    const activity = await prisma.athlete_activities.findFirst({
      where: { id: input.activityId, athleteId },
      select: { id: true },
    });
    if (!activity) {
      throw new Error('Activity not found');
    }
    const existing = await prisma.athlete_activity_posts.findFirst({
      where: { activityId: input.activityId },
    });
    if (existing && existing.athleteId !== athleteId) {
      throw new Error('Activity already linked to another reflection');
    }
    if (existing) {
      return updateTrainingReflection(athleteId, existing.id, input);
    }
  }

  const row = await prisma.athlete_activity_posts.create({
    data: {
      athleteId,
      ...(input.activityId ? { activityId: input.activityId } : {}),
      caption: input.caption,
      photoUrl: input.photoUrl,
      showMatchedWorkout: input.showMatchedWorkout,
      publishedAt: input.publish ? new Date() : null,
    },
    include: activityPostInclude,
  });
  return mapOwnerActivityPost(row);
}

export async function updateTrainingReflection(
  athleteId: string,
  postId: string,
  input: ReturnType<typeof normalizeTrainingReflectionInput>
): Promise<TrainingReflectionOwnerPayload> {
  const existing = await prisma.athlete_activity_posts.findFirst({
    where: { id: postId, athleteId },
  });
  if (!existing) {
    throw new Error('Reflection not found');
  }

  if (input.activityId && input.activityId !== existing.activityId) {
    const activity = await prisma.athlete_activities.findFirst({
      where: { id: input.activityId, athleteId },
      select: { id: true },
    });
    if (!activity) {
      throw new Error('Activity not found');
    }
    const taken = await prisma.athlete_activity_posts.findFirst({
      where: { activityId: input.activityId, id: { not: postId } },
    });
    if (taken) {
      throw new Error('Activity already linked to another reflection');
    }
  }

  const row = await prisma.athlete_activity_posts.update({
    where: { id: postId },
    data: {
      activityId: input.activityId ?? existing.activityId,
      caption: input.caption,
      photoUrl: input.photoUrl,
      showMatchedWorkout: input.showMatchedWorkout,
      publishedAt: input.publish ? existing.publishedAt ?? new Date() : null,
      updatedAt: new Date(),
    },
    include: activityPostInclude,
  });
  return mapOwnerActivityPost(row);
}

export async function deleteTrainingReflection(athleteId: string, postId: string): Promise<boolean> {
  const result = await prisma.athlete_activity_posts.deleteMany({
    where: { id: postId, athleteId },
  });
  return result.count > 0;
}
