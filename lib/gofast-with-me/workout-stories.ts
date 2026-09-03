import { prisma } from '@/lib/prisma';
import { howFeltLabel, normalizeHowFeltRating } from '@/lib/gofast-with-me/how-felt-labels';

const METERS_PER_MILE = 1609.344;
const MAX_TITLE = 120;
const MAX_REFLECTION = 4000;

export type WorkoutStoryPayload = {
  id: string;
  publicTitle: string | null;
  howFeltRating: number | null;
  howFeltLabel: string | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
  publishedAt: string;
  workoutType: string;
  plannedTitle: string;
  planName: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  workoutDate: string | null;
};

export type WorkoutStoryOwnerPayload = {
  id: string;
  publicTitle: string | null;
  howFeltRating: number | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
};

const workoutStorySelect = {
  id: true,
  title: true,
  workoutType: true,
  date: true,
  publicTitle: true,
  howFeltRating: true,
  reflection: true,
  workoutPhotoUrl: true,
  communityPublishedAt: true,
  actualDistanceMeters: true,
  actualDurationSeconds: true,
  training_plans: { select: { name: true } },
} as const;

type WorkoutStoryRow = {
  id: string;
  title: string;
  workoutType: string;
  date: Date | null;
  publicTitle: string | null;
  howFeltRating: number | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
  communityPublishedAt: Date | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  training_plans: { name: string } | null;
};

function metersToMiles(meters: number | null | undefined): number | null {
  if (meters == null || meters <= 0) return null;
  return meters / METERS_PER_MILE;
}

function mapPublishedStory(row: WorkoutStoryRow): WorkoutStoryPayload | null {
  if (!row.communityPublishedAt) return null;
  return {
    id: row.id,
    publicTitle: row.publicTitle?.trim() || null,
    howFeltRating: row.howFeltRating,
    howFeltLabel: howFeltLabel(row.howFeltRating),
    reflection: row.reflection?.trim() || null,
    workoutPhotoUrl: row.workoutPhotoUrl?.trim() || null,
    publishedAt: row.communityPublishedAt.toISOString(),
    workoutType: row.workoutType,
    plannedTitle: row.title,
    planName: row.training_plans?.name ?? null,
    distanceMiles: metersToMiles(row.actualDistanceMeters),
    durationSeconds: row.actualDurationSeconds,
    workoutDate: row.date?.toISOString() ?? null,
  };
}

export function mapOwnerWorkoutStory(row: WorkoutStoryRow): WorkoutStoryOwnerPayload {
  return {
    id: row.id,
    publicTitle: row.publicTitle?.trim() || null,
    howFeltRating: row.howFeltRating,
    reflection: row.reflection?.trim() || null,
    workoutPhotoUrl: row.workoutPhotoUrl?.trim() || null,
    publishedAt: row.communityPublishedAt?.toISOString() ?? null,
    isPublished: row.communityPublishedAt != null,
  };
}

export async function listPublishedWorkoutStories(
  athleteId: string,
  limit = 20
): Promise<WorkoutStoryPayload[]> {
  const rows = await prisma.workouts.findMany({
    where: { athleteId, communityPublishedAt: { not: null } },
    orderBy: { communityPublishedAt: 'desc' },
    take: limit,
    select: workoutStorySelect,
  });

  return rows
    .map((row) => mapPublishedStory(row as WorkoutStoryRow))
    .filter((story): story is WorkoutStoryPayload => story != null);
}

export async function getWorkoutStoryForOwner(
  athleteId: string,
  workoutId: string
): Promise<WorkoutStoryOwnerPayload | null> {
  const row = await prisma.workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: workoutStorySelect,
  });
  if (!row) return null;
  return mapOwnerWorkoutStory(row as WorkoutStoryRow);
}

export function normalizeWorkoutStoryInput(input: unknown): {
  publicTitle: string | null;
  howFeltRating: number | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
  publish: boolean;
} {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const titleRaw = typeof body.publicTitle === 'string' ? body.publicTitle.trim() : '';
  const publicTitle = titleRaw.length > 0 ? titleRaw.slice(0, MAX_TITLE) : null;
  const reflectionRaw = typeof body.reflection === 'string' ? body.reflection.trim() : '';
  const reflection = reflectionRaw.length > 0 ? reflectionRaw.slice(0, MAX_REFLECTION) : null;
  const workoutPhotoUrl =
    typeof body.workoutPhotoUrl === 'string' && body.workoutPhotoUrl.trim()
      ? body.workoutPhotoUrl.trim()
      : null;
  const howFeltRating =
    body.howFeltRating === null || body.howFeltRating === undefined
      ? null
      : normalizeHowFeltRating(body.howFeltRating);
  const publish = body.publish !== false;
  return { publicTitle, howFeltRating, reflection, workoutPhotoUrl, publish };
}

export function validateWorkoutStoryInput(
  input: ReturnType<typeof normalizeWorkoutStoryInput>
): string | null {
  return validateWorkoutReflectionInput(input);
}

export type WorkoutReflectionInput = {
  publicTitle: string | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
};

export function normalizeWorkoutReflectionInput(input: unknown): WorkoutReflectionInput {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const titleRaw = typeof body.publicTitle === 'string' ? body.publicTitle.trim() : '';
  const publicTitle = titleRaw.length > 0 ? titleRaw.slice(0, MAX_TITLE) : null;
  const reflectionRaw = typeof body.reflection === 'string' ? body.reflection.trim() : '';
  const reflection = reflectionRaw.length > 0 ? reflectionRaw.slice(0, MAX_REFLECTION) : null;
  const workoutPhotoUrl =
    typeof body.workoutPhotoUrl === 'string' && body.workoutPhotoUrl.trim()
      ? body.workoutPhotoUrl.trim()
      : null;
  return { publicTitle, reflection, workoutPhotoUrl };
}

export function validateWorkoutReflectionInput(input: WorkoutReflectionInput): string | null {
  if (!input.publicTitle && !input.reflection && !input.workoutPhotoUrl) {
    return 'Add a title, reflection, or photo to share this workout';
  }
  return null;
}

export async function getWorkoutReflectionForOwner(
  athleteId: string,
  workoutId: string
): Promise<WorkoutReflectionInput | null> {
  const row = await prisma.workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: {
      publicTitle: true,
      reflection: true,
      workoutPhotoUrl: true,
    },
  });
  if (!row) return null;
  return {
    publicTitle: row.publicTitle?.trim() || null,
    reflection: row.reflection?.trim() || null,
    workoutPhotoUrl: row.workoutPhotoUrl?.trim() || null,
  };
}

export async function saveWorkoutReflection(
  athleteId: string,
  workoutId: string,
  input: WorkoutReflectionInput
): Promise<WorkoutReflectionInput> {
  const workout = await prisma.workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: { id: true, communityPublishedAt: true },
  });
  if (!workout) {
    throw new Error('Workout not found');
  }

  const gwmHost = await prisma.gofast_with_me.findUnique({
    where: { athleteId },
    select: { id: true },
  });

  const data: {
    publicTitle: string | null;
    reflection: string | null;
    workoutPhotoUrl: string | null;
    communityPublishedAt?: Date;
  } = {
    publicTitle: input.publicTitle,
    reflection: input.reflection,
    workoutPhotoUrl: input.workoutPhotoUrl,
  };

  if (gwmHost) {
    data.communityPublishedAt = workout.communityPublishedAt ?? new Date();
  }

  const row = await prisma.workouts.update({
    where: { id: workoutId },
    data,
    select: {
      publicTitle: true,
      reflection: true,
      workoutPhotoUrl: true,
    },
  });

  return {
    publicTitle: row.publicTitle?.trim() || null,
    reflection: row.reflection?.trim() || null,
    workoutPhotoUrl: row.workoutPhotoUrl?.trim() || null,
  };
}

export async function upsertWorkoutCommunityStory(
  athleteId: string,
  workoutId: string,
  input: ReturnType<typeof normalizeWorkoutStoryInput>
): Promise<WorkoutStoryOwnerPayload> {
  const workout = await prisma.workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: { id: true },
  });
  if (!workout) {
    throw new Error('Workout not found');
  }

  const communityPublishedAt = input.publish ? new Date() : null;

  const row = await prisma.workouts.update({
    where: { id: workoutId },
    data: {
      publicTitle: input.publicTitle,
      howFeltRating: input.howFeltRating,
      reflection: input.reflection,
      workoutPhotoUrl: input.workoutPhotoUrl,
      communityPublishedAt,
    },
    select: workoutStorySelect,
  });

  return mapOwnerWorkoutStory(row as WorkoutStoryRow);
}

export async function unpublishWorkoutCommunityStory(
  athleteId: string,
  workoutId: string
): Promise<boolean> {
  const result = await prisma.workouts.updateMany({
    where: { id: workoutId, athleteId, communityPublishedAt: { not: null } },
    data: { communityPublishedAt: null },
  });
  return result.count > 0;
}
