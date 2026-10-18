import { prisma } from '@/lib/prisma';

export type ClubAssociationHydration = {
  runClubId: string;
  nameSnapshot: string;
  logoUrlSnapshot: string | null;
};

export function mapClubAssociationRow(row: {
  runClubId: string;
  nameSnapshot: string;
  logoUrlSnapshot: string | null;
}): ClubAssociationHydration {
  return {
    runClubId: row.runClubId,
    nameSnapshot: row.nameSnapshot,
    logoUrlSnapshot: row.logoUrlSnapshot,
  };
}

export const cityRunClubAssociationSelect = {
  runClubId: true,
  nameSnapshot: true,
  logoUrlSnapshot: true,
} as const;

function normalizeAssociatedId(raw: unknown): string | null {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** Parse optional associatedRunClubId from API body; undefined means no change. */
export function associatedRunClubIdFromBody(
  body: Record<string, unknown>
): string | null | undefined {
  if (body.associatedRunClubId === undefined) return undefined;
  return normalizeAssociatedId(body.associatedRunClubId);
}

async function loadClubSnapshots(runClubId: string) {
  const club = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: { id: true, name: true, logoUrl: true },
  });
  if (!club) return null;
  return {
    runClubId: club.id,
    nameSnapshot: club.name.trim() || 'Run club',
    logoUrlSnapshot: club.logoUrl?.trim() || null,
  };
}

/**
 * Upsert or remove association for athlete-hosted runs only.
 * Never writes city_runs.runClubId.
 */
export async function syncCityRunClubAssociation(opts: {
  cityRunId: string;
  associatedRunClubId: string | null | undefined;
  athleteGeneratedId: string | null;
  runClubId: string | null;
}): Promise<void> {
  const { cityRunId, associatedRunClubId, athleteGeneratedId, runClubId } = opts;

  if (associatedRunClubId === undefined) {
    return;
  }

  if (runClubId) {
    await prisma.city_run_club_associations.deleteMany({ where: { cityRunId } });
    return;
  }

  if (!associatedRunClubId) {
    await prisma.city_run_club_associations.deleteMany({ where: { cityRunId } });
    return;
  }

  if (!athleteGeneratedId?.trim()) {
    await prisma.city_run_club_associations.deleteMany({ where: { cityRunId } });
    return;
  }

  const snaps = await loadClubSnapshots(associatedRunClubId);
  if (!snaps) {
    await prisma.city_run_club_associations.deleteMany({ where: { cityRunId } });
    return;
  }

  await prisma.city_run_club_associations.upsert({
    where: { cityRunId },
    create: {
      cityRunId,
      runClubId: snaps.runClubId,
      nameSnapshot: snaps.nameSnapshot,
      logoUrlSnapshot: snaps.logoUrlSnapshot,
    },
    update: {
      runClubId: snaps.runClubId,
      nameSnapshot: snaps.nameSnapshot,
      logoUrlSnapshot: snaps.logoUrlSnapshot,
      updatedAt: new Date(),
    },
  });
}

/** Remove association when run becomes club-owned. */
export async function clearCityRunClubAssociation(cityRunId: string): Promise<void> {
  await prisma.city_run_club_associations.deleteMany({ where: { cityRunId } });
}
