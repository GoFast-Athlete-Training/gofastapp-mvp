import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';
import { isClubManagerWriteRole } from '@/lib/run-club-leader-scope';

export type StaffClub = { id: string; slug: string | null; name: string };

/**
 * Staff-forwarded club manage (gf-clubmanage → Prod).
 * Satellite verifies club assignment; Prod verifies Firebase Bearer + x-gofast-staff-id.
 */
export async function assertStaffClubManage(
  request: NextRequest,
  clubId: string
): Promise<{ club: StaffClub; error: null } | { club: null; error: NextResponse }> {
  const staffErr = await assertStaffBearerAuth(request);
  if (staffErr) return { club: null, error: staffErr };

  const id = clubId.trim();
  if (!id) {
    return {
      club: null,
      error: NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 }),
    };
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true },
  });
  if (!club) {
    return {
      club: null,
      error: NextResponse.json({ success: false, error: 'Run club not found' }, { status: 404 }),
    };
  }

  return { club, error: null };
}

/** Author for staff-created announcements/events: an active club manager athlete. */
export async function resolveClubAuthorAthleteId(clubId: string): Promise<string | null> {
  const rows = await prisma.run_club_memberships.findMany({
    where: { runClubId: clubId, status: 'active' },
    select: { athleteId: true, role: true },
    take: 20,
  });
  const writer = rows.find((row) => isClubManagerWriteRole(row.role));
  return writer?.athleteId ?? null;
}
