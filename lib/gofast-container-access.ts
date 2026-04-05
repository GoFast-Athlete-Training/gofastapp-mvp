import { prisma } from '@/lib/prisma';

/** Host or active member can read/post container messages. */
export async function canAccessGoFastContainer(
  containerHostAthleteId: string,
  callerAthleteId: string
): Promise<boolean> {
  if (callerAthleteId === containerHostAthleteId) return true;
  const m = await prisma.gofast_container_memberships.findUnique({
    where: {
      containerAthleteId_memberAthleteId: {
        containerAthleteId: containerHostAthleteId,
        memberAthleteId: callerAthleteId,
      },
    },
  });
  return !!m;
}
