import { prisma } from '@/lib/prisma';

/** Best-effort update when a signed-in athlete bootstraps the app. */
export async function touchAthleteLastSeen(athleteId: string): Promise<void> {
  try {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.warn('[touchAthleteLastSeen] failed for', athleteId, err);
  }
}
