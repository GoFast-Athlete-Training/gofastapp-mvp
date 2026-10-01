import { prisma } from '@/lib/prisma';
import type { AthleteRole } from '@prisma/client';
import { isClubManagerWriteRole } from '@/lib/club-manager-membership-roles';
import { listLeaderMemberships } from '@/lib/run-club-leader-auth';

const PRODUCT_ROLES: AthleteRole[] = ['CLUB_LEADER', 'AMBASSADOR'];

export function isAthleteProductRole(role: string): role is AthleteRole {
  return PRODUCT_ROLES.includes(role as AthleteRole);
}

export async function listAthleteProductRoles(athleteId: string): Promise<AthleteRole[]> {
  const rows = await prisma.athlete_product_roles.findMany({
    where: { athleteId },
    select: { role: true },
  });
  return rows.map((r) => r.role);
}

export async function upsertAthleteProductRole(athleteId: string, role: AthleteRole) {
  if (!isAthleteProductRole(role)) {
    throw new Error(`Invalid product role: ${role}`);
  }
  await prisma.athlete_product_roles.upsert({
    where: { athleteId_role: { athleteId, role } },
    create: { athleteId, role },
    update: {},
  });
}

export async function removeAthleteProductRole(athleteId: string, role: AthleteRole) {
  await prisma.athlete_product_roles.deleteMany({
    where: { athleteId, role },
  });
}

/** Drop CLUB_LEADER product distinction when athlete has no active manager/admin memberships. */
export async function syncClubLeaderProductRole(athleteId: string) {
  const memberships = await listLeaderMemberships(athleteId);
  const hasWriteMembership = memberships.some((m) => isClubManagerWriteRole(m.role));
  if (hasWriteMembership) {
    await upsertAthleteProductRole(athleteId, 'CLUB_LEADER');
  } else {
    await removeAthleteProductRole(athleteId, 'CLUB_LEADER');
  }
}

export async function athleteHasProductRole(athleteId: string, role: AthleteRole): Promise<boolean> {
  const row = await prisma.athlete_product_roles.findUnique({
    where: { athleteId_role: { athleteId, role } },
    select: { id: true },
  });
  return Boolean(row);
}
