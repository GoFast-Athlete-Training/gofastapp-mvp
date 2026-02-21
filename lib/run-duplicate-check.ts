import type { PrismaClient } from "@prisma/client";

/**
 * Per-club run duplicate check (see SEED_BY_CATEGORY_DEEP_DIVE).
 * Match: same runClubId + (same normalized title + same calendar date) OR same webUrl.
 */
export type RunDuplicateCheckParams = {
  runClubId: string | null;
  title: string;
  startDate: Date;
  webUrl?: string | null;
};

export async function findExistingRun(
  prisma: PrismaClient,
  params: RunDuplicateCheckParams
): Promise<{ id: string; title: string; startDate: Date } | null> {
  const { runClubId, title, startDate, webUrl } = params;
  if (!runClubId) return null;

  const normalizedTitle = title.trim().toLowerCase();
  const dayStart = new Date(startDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Match by webUrl first if provided (one run per source URL per club)
  if (webUrl && webUrl.trim()) {
    const byUrl = await prisma.city_runs.findFirst({
      where: {
        runClubId,
        webUrl: { equals: webUrl.trim(), mode: "insensitive" },
      },
      select: { id: true, title: true, startDate: true },
    });
    if (byUrl) return byUrl;
  }

  // Match by title + same calendar day
  const runs = await prisma.city_runs.findMany({
    where: {
      runClubId,
      startDate: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, title: true, startDate: true },
  });
  for (const run of runs) {
    if (run.title.trim().toLowerCase() === normalizedTitle) return run;
  }
  return null;
}
