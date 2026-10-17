import { prisma } from "@/lib/prisma";

export type PurgeUnclaimedResult = {
  scanned: number;
  eligible: number;
  deleted: number;
  skippedRsvps: number;
  skippedPublished: number;
};

/**
 * Delete club/series city_runs with no RSVPs that were never published.
 * Keeps run_series and run_clubs intact.
 */
export async function purgeUnclaimedClubRuns(opts?: {
  runClubId?: string | null;
  dryRun?: boolean;
}): Promise<PurgeUnclaimedResult> {
  const runClubId = opts?.runClubId?.trim() || null;
  const dryRun = opts?.dryRun === true;

  const candidates = await prisma.city_runs.findMany({
    where: {
      published: false,
      runClubId: runClubId ? runClubId : { not: null },
      ...(runClubId ? {} : {}),
    },
    select: {
      id: true,
      published: true,
      _count: { select: { city_run_rsvps: true } },
    },
  });

  let skippedRsvps = 0;
  let skippedPublished = 0;
  const toDelete: string[] = [];

  for (const row of candidates) {
    if (row.published) {
      skippedPublished += 1;
      continue;
    }
    if (row._count.city_run_rsvps > 0) {
      skippedRsvps += 1;
      continue;
    }
    toDelete.push(row.id);
  }

  if (!dryRun && toDelete.length > 0) {
    await prisma.city_runs.deleteMany({ where: { id: { in: toDelete } } });
  }

  return {
    scanned: candidates.length,
    eligible: toDelete.length,
    deleted: dryRun ? 0 : toDelete.length,
    skippedRsvps,
    skippedPublished,
  };
}
