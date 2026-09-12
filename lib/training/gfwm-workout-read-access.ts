import { prisma } from '@/lib/prisma';
import { canAccessGfwmHostContent } from '@/lib/gfwm-member-access';

/** Resolve which athlete owns a workout row (planned or legacy workouts table). */
export async function resolveWorkoutOwnerAthleteId(workoutId: string): Promise<string | null> {
  const trimmed = workoutId.trim();
  if (!trimmed) return null;

  const legacy = await prisma.workouts.findFirst({
    where: { id: trimmed },
    select: { athleteId: true },
  });
  if (legacy?.athleteId) return legacy.athleteId;

  const planned = await prisma.planned_workouts.findFirst({
    where: { id: trimmed },
    select: { athleteId: true },
  });
  return planned?.athleteId ?? null;
}

/** Owner or gfwm member may read host workouts; otherwise null. */
export async function resolveReadableWorkoutAthleteId(
  workoutId: string,
  viewerAthleteId: string
): Promise<{ athleteId: string; isOwner: boolean } | null> {
  const ownerAthleteId = await resolveWorkoutOwnerAthleteId(workoutId);
  if (!ownerAthleteId) return null;

  if (ownerAthleteId === viewerAthleteId) {
    return { athleteId: ownerAthleteId, isOwner: true };
  }

  const allowed = await canAccessGfwmHostContent(ownerAthleteId, viewerAthleteId);
  if (!allowed) return null;

  return { athleteId: ownerAthleteId, isOwner: false };
}
