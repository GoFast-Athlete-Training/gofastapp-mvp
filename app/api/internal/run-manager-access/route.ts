export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

/** GET /api/internal/run-manager-access — list access rows for Admin Manage */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const email = request.nextUrl.searchParams.get('email')?.trim();

  const accessRows = await prisma.run_manager_access.findMany({
    where: email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: email ? 20 : 100,
  });

  return NextResponse.json({ success: true, access: accessRows, grants: accessRows });
}
