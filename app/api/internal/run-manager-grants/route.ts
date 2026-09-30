export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

/** GET /api/internal/run-manager-grants — list grants for Admin Manage */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const email = request.nextUrl.searchParams.get('email')?.trim();

  const grants = await prisma.run_manager_grants.findMany({
    where: email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: email ? 20 : 100,
  });

  return NextResponse.json({ success: true, grants });
}
