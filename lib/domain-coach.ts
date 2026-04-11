import { prisma } from '@/lib/prisma';

export async function getCoachByFirebaseId(firebaseId: string) {
  return prisma.coach.findUnique({
    where: { firebaseId },
  });
}
