import { prisma } from '@/lib/prisma';

/** Host or active gfwm_athlete member can read host-scoped athlete content. */
export async function canAccessGfwmHostContent(
  hostAthleteId: string,
  callerAthleteId: string
): Promise<boolean> {
  if (callerAthleteId === hostAthleteId) return true;
  const membership = await prisma.gfwm_athlete.findUnique({
    where: {
      athleteId_memberAthleteId: {
        athleteId: hostAthleteId,
        memberAthleteId: callerAthleteId,
      },
    },
    select: { id: true },
  });
  return !!membership;
}

/** @deprecated alias — use canAccessGfwmHostContent */
export const canAccessGoFastContainer = canAccessGfwmHostContent;
