export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { GOFAST_COMPANY_ID } from '@/lib/goFastCompanyConfig';
import { coachDisplayNameFromToken } from '@/lib/coachDisplayNameFromToken';

/** POST /api/coach — create or sync Coach from Firebase token (upsert by firebaseId) */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    const displayName =
      (decodedToken as { name?: string }).name ||
      (decodedToken as { displayName?: string }).displayName ||
      undefined;
    const picture =
      (decodedToken as { picture?: string }).picture || undefined;

    const { firstName, lastName } = coachDisplayNameFromToken(displayName);

    let company = await prisma.go_fast_companies.findUnique({
      where: { id: GOFAST_COMPANY_ID },
    });
    if (!company) {
      company = await prisma.go_fast_companies.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (!company) {
        return NextResponse.json(
          {
            success: false,
            error: 'No GoFast company configured',
          },
          { status: 500 }
        );
      }
    }

    const existing = await prisma.coach.findUnique({
      where: { firebaseId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoURL: true,
      },
    });

    const updateData: Record<string, unknown> = {};
    const createData: Record<string, unknown> = {
      firebaseId,
      companyId: company.id,
    };

    if (email !== undefined) {
      updateData.email = email;
      createData.email = email;
    }
    if (displayName !== undefined && (firstName !== null || lastName !== null)) {
      createData.firstName = firstName;
      createData.lastName = lastName;
      const hasBoth = existing?.firstName && existing?.lastName;
      const hasAny = existing?.firstName || existing?.lastName;
      if (!hasBoth) {
        if (!hasAny) {
          updateData.firstName = firstName;
          updateData.lastName = lastName;
        } else {
          if (!existing?.firstName && firstName !== null)
            updateData.firstName = firstName;
          if (!existing?.lastName && lastName !== null)
            updateData.lastName = lastName;
        }
      }
    }
    if (picture !== undefined) {
      createData.photoURL = picture;
      if (!existing?.photoURL) updateData.photoURL = picture;
    }
    updateData.companyId = company.id;

    const coach = await prisma.coach.upsert({
      where: { firebaseId },
      update: updateData,
      create: createData as Parameters<typeof prisma.coach.create>[0]['data'],
    });

    return NextResponse.json({
      success: true,
      message: 'Coach found or created',
      coachId: coach.id,
      coach: serializeCoach(coach),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('COACH CREATE:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: message },
      { status: 500 }
    );
  }
}

function serializeCoach(c: {
  id: string;
  firebaseId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  bio: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    firebaseId: c.firebaseId,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    photoURL: c.photoURL,
    bio: c.bio,
    specialty: c.specialty,
    city: c.city,
    state: c.state,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
