export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listClaimsForRunClub } from '@/lib/domain-runclub-leader-claim';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

/**
 * GET /api/internal/run-club-leader-claims?runClubId=
 * Company → Product: list seeded claim rows for a run club.
 */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const runClubId = searchParams.get('runClubId')?.trim();
  if (!runClubId) {
    return NextResponse.json({ success: false, error: 'runClubId is required' }, { status: 400 });
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: { id: true, slug: true, name: true },
  });

  if (!club) {
    return NextResponse.json({
      success: true,
      clubExists: false,
      claims: [],
    });
  }

  const claims = await listClaimsForRunClub(runClubId);

  return NextResponse.json({
    success: true,
    clubExists: true,
    runClub: club,
    claims,
  });
}
