import { prisma } from '@/lib/prisma';

const METERS_PER_MILE = 1609.344;
const MAX_CAPTION = 2000;

export type ActivityPostMatchedWorkout = {
  title: string;
  workoutType: string;
  planName: string | null;
};

export type ActivityPostActivitySummary = {
  activityName: string | null;
  startTime: string;
  distanceMiles: number | null;
  durationSeconds: number | null;
  activityType: string | null;
};

export type ActivityPostPayload = {
  id: string;
  activityId: string;
  caption: string | null;
  photoUrl: string | null;
  showMatchedWorkout: boolean;
  publishedAt: string;
  activity: ActivityPostActivitySummary;
  matchedWorkout: ActivityPostMatchedWorkout | null;
};

export type ActivityPostOwnerPayload = {
  id: string;
  activityId: string;
  caption: string | null;
  photoUrl: string | null;
  showMatchedWorkout: boolean;
  publishedAt: string | null;
  isPublished: boolean;
};

const activityPostInclude = {
  activity: {
    select: {
      activityName: true,
      startTime: true,
      distance: true,
      duration: true,
      activityType: true,
      matched_workout: {
        select: {
          title: true,
          workoutType: true,
          training_plans: { select: { name: true } },
        },
      },
    },
  },
} as const;

type ActivityPostRow = Awaited<
  ReturnType<typeof prisma.athlete_activity_posts.findFirst>
> & {
  activity: {
    activityName: string | null;
    startTime: Date | null;
    distance: number | null;
    duration: number | null;
    activityType: string | null;
    matched_workout: {
      title: string;
      workoutType: string;
      training_plans: { name: string } | null;
    } | null;
  };
};

function metersToMiles(meters: number | null | undefined): number | null {
  if (meters == null || meters <= 0) return null;
  return meters / METERS_PER_MILE;
}

function mapActivitySummary(
  activity: ActivityPostRow['activity']
): ActivityPostActivitySummary {
  return {
    activityName: activity.activityName,
    startTime: activity.startTime?.toISOString() ?? new Date(0).toISOString(),
    distanceMiles: metersToMiles(activity.distance),
    durationSeconds: activity.duration,
    activityType: activity.activityType,
  };
}

function mapMatchedWorkout(
  activity: ActivityPostRow['activity'],
  showMatchedWorkout: boolean
): ActivityPostMatchedWorkout | null {
  if (!showMatchedWorkout || !activity.matched_workout) return null;
  return {
    title: activity.matched_workout.title,
    workoutType: activity.matched_workout.workoutType,
    planName: activity.matched_workout.training_plans?.name ?? null,
  };
}

export function mapPublishedActivityPost(row: ActivityPostRow): ActivityPostPayload | null {
  if (!row.publishedAt) return null;
  return {
    id: row.id,
    activityId: row.activityId,
    caption: row.caption?.trim() || null,
    photoUrl: row.photoUrl?.trim() || null,
    showMatchedWorkout: row.showMatchedWorkout,
    publishedAt: row.publishedAt.toISOString(),
    activity: mapActivitySummary(row.activity),
    matchedWorkout: mapMatchedWorkout(row.activity, row.showMatchedWorkout),
  };
}

export function mapOwnerActivityPost(row: ActivityPostRow): ActivityPostOwnerPayload {
  return {
    id: row.id,
    activityId: row.activityId,
    caption: row.caption?.trim() || null,
    photoUrl: row.photoUrl?.trim() || null,
    showMatchedWorkout: row.showMatchedWorkout,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isPublished: row.publishedAt != null,
  };
}

export async function listPublishedActivityPosts(
  athleteId: string,
  limit = 20
): Promise<ActivityPostPayload[]> {
  const rows = await prisma.athlete_activity_posts.findMany({
    where: { athleteId, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: activityPostInclude,
  });

  return rows
    .map((row) => mapPublishedActivityPost(row as ActivityPostRow))
    .filter((post): post is ActivityPostPayload => post != null);
}

export async function getActivityPostForActivity(
  athleteId: string,
  activityId: string
): Promise<ActivityPostOwnerPayload | null> {
  const row = await prisma.athlete_activity_posts.findFirst({
    where: { athleteId, activityId },
    include: activityPostInclude,
  });
  if (!row) return null;
  return mapOwnerActivityPost(row as ActivityPostRow);
}

export function normalizeActivityPostInput(input: unknown): {
  activityId: string;
  caption: string | null;
  photoUrl: string | null;
  showMatchedWorkout: boolean;
  publish: boolean;
} {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const activityId = typeof body.activityId === 'string' ? body.activityId.trim() : '';
  const captionRaw = typeof body.caption === 'string' ? body.caption.trim() : '';
  const caption = captionRaw.length > 0 ? captionRaw.slice(0, MAX_CAPTION) : null;
  const photoUrl =
    typeof body.photoUrl === 'string' && body.photoUrl.trim() ? body.photoUrl.trim() : null;
  const showMatchedWorkout = body.showMatchedWorkout !== false;
  const publish = body.publish !== false;
  return { activityId, caption, photoUrl, showMatchedWorkout, publish };
}

export function validateActivityPostInput(input: ReturnType<typeof normalizeActivityPostInput>): string | null {
  if (!input.activityId) return 'activityId is required';
  if (!input.caption && !input.photoUrl) {
    return 'Add a caption or photo to share this activity';
  }
  return null;
}

export async function upsertActivityPost(
  athleteId: string,
  input: ReturnType<typeof normalizeActivityPostInput>
): Promise<ActivityPostOwnerPayload> {
  const activity = await prisma.athlete_activities.findFirst({
    where: { id: input.activityId, athleteId },
    select: { id: true },
  });
  if (!activity) {
    throw new Error('Activity not found');
  }

  const publishedAt = input.publish ? new Date() : null;

  const row = await prisma.athlete_activity_posts.upsert({
    where: { activityId: input.activityId },
    create: {
      athleteId,
      activityId: input.activityId,
      caption: input.caption,
      photoUrl: input.photoUrl,
      showMatchedWorkout: input.showMatchedWorkout,
      publishedAt,
    },
    update: {
      caption: input.caption,
      photoUrl: input.photoUrl,
      showMatchedWorkout: input.showMatchedWorkout,
      publishedAt,
    },
    include: activityPostInclude,
  });

  return mapOwnerActivityPost(row as ActivityPostRow);
}

export async function unpublishActivityPost(
  athleteId: string,
  postId: string
): Promise<boolean> {
  const result = await prisma.athlete_activity_posts.updateMany({
    where: { id: postId, athleteId },
    data: { publishedAt: null },
  });
  return result.count > 0;
}
