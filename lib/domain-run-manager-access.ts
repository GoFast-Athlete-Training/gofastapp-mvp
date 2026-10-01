import { prisma } from '@/lib/prisma';
import { normalizeLeaderEmail } from '@/lib/domain-runclub-leader-claim';

export type RunManagerAccessStatus = 'unclaimed' | 'active' | 'revoked';

export function normalizeRunManagerEmail(email: string): string | null {
  return normalizeLeaderEmail(email);
}

export function generateRunManagerAccessId(): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `rma_${random}`;
}

export async function assignRunManagerAccess(input: {
  accessId: string;
  athleteId: string;
  email: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
  assignedByStaffId?: string | null;
}) {
  const accessId = input.accessId.trim();
  const athleteId = input.athleteId.trim();
  const email = normalizeRunManagerEmail(input.email);
  if (!email) {
    throw new Error('email is invalid');
  }

  const displayName = input.displayName?.trim() || null;

  await prisma.run_manager_access.upsert({
    where: { id: accessId },
    create: {
      id: accessId,
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

  return prisma.run_manager_access.findUnique({ where: { id: accessId } });
}

export async function seedRunManagerAccessStub(input: {
  accessId: string;
  email: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
  assignedByStaffId?: string | null;
}) {
  const accessId = input.accessId.trim();
  const email = normalizeRunManagerEmail(input.email);
  if (!email) {
    throw new Error('email is invalid');
  }
  const displayName = input.displayName?.trim() || null;

  return prisma.run_manager_access.upsert({
    where: { id: accessId },
    create: {
      id: accessId,
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

export async function revokeRunManagerAccess(accessId: string) {
  const id = accessId.trim();
  const existing = await prisma.run_manager_access.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.run_manager_access.update({
    where: { id },
    data: { status: 'revoked' },
  });
}

export async function claimRunManagerAccessForAthlete(
  athleteId: string,
  athleteEmail: string | null | undefined,
) {
  const normalizedEmail = normalizeRunManagerEmail(athleteEmail ?? '');
  if (!normalizedEmail) return { claimed: 0 };

  const pending = await prisma.run_manager_access.findMany({
    where: { email: normalizedEmail, status: 'unclaimed' },
  });

  if (pending.length === 0) return { claimed: 0 };

  for (const row of pending) {
    await assignRunManagerAccess({
      accessId: row.id,
      athleteId,
      email: row.email,
      displayName: row.displayName,
      managerAssignmentId: row.managerAssignmentId,
      assignedByStaffId: row.assignedByStaffId,
    });
  }

  return { claimed: pending.length };
}

export async function athleteHasRunManagerAccess(athleteId: string): Promise<boolean> {
  const row = await prisma.run_manager_access.findFirst({
    where: { athleteId, status: 'active' },
    select: { id: true },
  });
  return Boolean(row);
}

/** staffGeneratedId for run authoring — prefer linked staff id on access row when present. */
export async function getRunManagerAccessForAthlete(athleteId: string) {
  return prisma.run_manager_access.findFirst({
    where: { athleteId, status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
}

export function staffGeneratedIdFromAccessRow(row: {
  id: string;
  assignedByStaffId: string | null;
}): string {
  if (row.id.startsWith('rma_') && row.assignedByStaffId) {
    return row.assignedByStaffId;
  }
  return row.id;
}
