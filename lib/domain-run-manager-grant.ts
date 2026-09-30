import { prisma } from '@/lib/prisma';
import { upsertAthleteProductRole, removeAthleteProductRole } from '@/lib/athlete-product-roles';
import { normalizeLeaderEmail } from '@/lib/domain-runclub-leader-claim';

export type RunManagerGrantStatus = 'unclaimed' | 'active' | 'revoked';

export function normalizeRunManagerEmail(email: string): string | null {
  return normalizeLeaderEmail(email);
}

export async function assignRunManagerToAthlete(input: {
  staffId: string;
  athleteId: string;
  email: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
  assignedByStaffId?: string | null;
}) {
  const staffId = input.staffId.trim();
  const athleteId = input.athleteId.trim();
  const email = normalizeRunManagerEmail(input.email);
  if (!email) {
    throw new Error('email is invalid');
  }

  const displayName = input.displayName?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.run_manager_grants.upsert({
      where: { id: staffId },
      create: {
        id: staffId,
        email,
        displayName,
        athleteId,
        status: 'active',
        managerAssignmentId: input.managerAssignmentId ?? null,
        assignedByStaffId: input.assignedByStaffId ?? null,
        claimedAt: new Date(),
      },
      update: {
        email,
        displayName: displayName ?? undefined,
        athleteId,
        status: 'active',
        managerAssignmentId: input.managerAssignmentId ?? undefined,
        assignedByStaffId: input.assignedByStaffId ?? undefined,
        claimedAt: new Date(),
      },
    });
  });

  await upsertAthleteProductRole(athleteId, 'RUN_MANAGER');

  const grant = await prisma.run_manager_grants.findUnique({ where: { id: staffId } });
  return grant;
}

export async function seedRunManagerGrantStub(input: {
  staffId: string;
  email: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
  assignedByStaffId?: string | null;
}) {
  const staffId = input.staffId.trim();
  const email = normalizeRunManagerEmail(input.email);
  if (!email) {
    throw new Error('email is invalid');
  }
  const displayName = input.displayName?.trim() || null;

  return prisma.run_manager_grants.upsert({
    where: { id: staffId },
    create: {
      id: staffId,
      email,
      displayName,
      status: 'unclaimed',
      managerAssignmentId: input.managerAssignmentId ?? null,
      assignedByStaffId: input.assignedByStaffId ?? null,
    },
    update: {
      email,
      displayName: displayName ?? undefined,
      status: 'unclaimed',
      athleteId: null,
      claimedAt: null,
      managerAssignmentId: input.managerAssignmentId ?? undefined,
      assignedByStaffId: input.assignedByStaffId ?? undefined,
    },
  });
}

export async function revokeRunManagerGrant(staffId: string) {
  const id = staffId.trim();
  const existing = await prisma.run_manager_grants.findUnique({ where: { id } });
  if (!existing) return null;

  const updated = await prisma.run_manager_grants.update({
    where: { id },
    data: { status: 'revoked' },
  });

  if (existing.athleteId) {
    await removeAthleteProductRole(existing.athleteId, 'RUN_MANAGER');
  }

  return updated;
}

export async function claimRunManagerGrantsForAthlete(athleteId: string, athleteEmail: string | null | undefined) {
  const normalizedEmail = normalizeRunManagerEmail(athleteEmail ?? '');
  if (!normalizedEmail) return { claimed: 0 };

  const pending = await prisma.run_manager_grants.findMany({
    where: { email: normalizedEmail, status: 'unclaimed' },
  });

  if (pending.length === 0) return { claimed: 0 };

  for (const grant of pending) {
    await assignRunManagerToAthlete({
      staffId: grant.id,
      athleteId,
      email: grant.email,
      displayName: grant.displayName,
      managerAssignmentId: grant.managerAssignmentId,
      assignedByStaffId: grant.assignedByStaffId,
    });
  }

  return { claimed: pending.length };
}

export async function athleteHasRunManagerAccess(athleteId: string): Promise<boolean> {
  const roleRow = await prisma.athlete_product_roles.findUnique({
    where: { athleteId_role: { athleteId, role: 'RUN_MANAGER' } },
    select: { id: true },
  });
  if (roleRow) return true;

  const grant = await prisma.run_manager_grants.findFirst({
    where: { athleteId, status: 'active' },
    select: { id: true },
  });
  return Boolean(grant);
}

export async function getRunManagerGrantForStaffId(staffId: string) {
  return prisma.run_manager_grants.findUnique({ where: { id: staffId.trim() } });
}
