import { prisma } from '@/lib/prisma';

/** Skip writes when lastSeenAt was updated within this window. */
const STALE_MS = 15 * 60 * 1000;

/** Best-effort update when a signed-in athlete bootstraps the app. */
export async function touchAthleteLastSeenIfStale(
  athleteId: string,
  lastSeenAt: Date | null | undefined
): Promise<void> {
  const now = Date.now();
  if (lastSeenAt && now - lastSeenAt.getTime() < STALE_MS) {
    return;
  }

  try {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.warn('[touchAthleteLastSeenIfStale] failed for', athleteId, err);
  }
}

/** @deprecated Prefer touchAthleteLastSeenIfStale on bootstrap paths. */
export async function touchAthleteLastSeen(athleteId: string): Promise<void> {
  await touchAthleteLastSeenIfStale(athleteId, null);
}

export function isPrismaPoolTimeout(err: unknown): boolean {
  return (
    err != null &&
    typeof err === 'object' &&
    'code' in err &&
    String((err as { code?: string }).code) === 'P2024'
  );
}
