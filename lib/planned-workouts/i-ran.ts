import { prisma } from '@/lib/prisma';
import { RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';

export type IRanRole = 'host' | 'running';

export function rsvpRoleToIRanRole(rsvpRole: string | null | undefined): IRanRole {
  return rsvpRole === RSVP_ROLE_HOST ? 'host' : 'running';
}

/** Stamp I-ran on the athlete's planned_workouts row for this city run. */
export async function stampPlannedWorkoutIRan(params: {
  athleteId: string;
  cityRunId: string;
  role: IRanRole;
  at?: Date;
}): Promise<{ ok: true; plannedWorkoutId: string } | { ok: false; code: 'no_stamp' }> {
  const stamp = await prisma.planned_workouts.findFirst({
    where: { athleteId: params.athleteId, cityRunId: params.cityRunId },
    select: { id: true },
  });
  if (!stamp) {
    return { ok: false, code: 'no_stamp' };
  }

  await prisma.planned_workouts.update({
    where: { id: stamp.id },
    data: {
      iRanAt: params.at ?? new Date(),
      iRanRole: params.role,
      iRanDeclined: false,
      updatedAt: new Date(),
    },
  });

  return { ok: true, plannedWorkoutId: stamp.id };
}

/** Athlete tapped No — do not create I-ran row; stop prompting. */
export async function declinePlannedWorkoutIRan(params: {
  athleteId: string;
  cityRunId: string;
}): Promise<{ ok: true } | { ok: false; code: 'no_stamp' }> {
  const stamp = await prisma.planned_workouts.findFirst({
    where: { athleteId: params.athleteId, cityRunId: params.cityRunId },
    select: { id: true },
  });
  if (!stamp) {
    return { ok: false, code: 'no_stamp' };
  }

  await prisma.planned_workouts.update({
    where: { id: stamp.id },
    data: {
      iRanDeclined: true,
      updatedAt: new Date(),
    },
  });

  return { ok: true };
}

export async function athleteHasIRanEvidence(params: {
  athleteId: string;
  cityRunId: string;
}): Promise<boolean> {
  const stamp = await prisma.planned_workouts.findFirst({
    where: {
      athleteId: params.athleteId,
      cityRunId: params.cityRunId,
      iRanAt: { not: null },
    },
    select: { id: true },
  });
  if (stamp) return true;

  const checkin = await prisma.city_run_checkins.findUnique({
    where: {
      runId_athleteId: { runId: params.cityRunId, athleteId: params.athleteId },
    },
    select: { checkedInAt: true },
  });
  return Boolean(checkin?.checkedInAt);
}
