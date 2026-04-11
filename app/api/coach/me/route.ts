export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getCoachByFirebaseId } from '@/lib/domain-coach';
import { prisma } from '@/lib/prisma';

async function verifyCoach(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const coach = await getCoachByFirebaseId(decoded.uid);
    if (!coach) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Coach not found' },
          { status: 404 }
        ),
      };
    }
    return { coach };
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      ),
    };
  }
}

/** GET /api/coach/me */
export async function GET(request: Request) {
  const result = await verifyCoach(request);
  if ('error' in result && result.error) return result.error;
  const { coach } = result as { coach: NonNullable<Awaited<ReturnType<typeof getCoachByFirebaseId>>> };
  return NextResponse.json({
    success: true,
    coachId: coach.id,
    coach: serializeCoach(coach),
  });
}

/** PATCH /api/coach/me — update profile fields on Coach entity */
export async function PATCH(request: Request) {
  const result = await verifyCoach(request);
  if ('error' in result && result.error) return result.error;
  const { coach } = result as { coach: NonNullable<Awaited<ReturnType<typeof getCoachByFirebaseId>>> };

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = [
    'firstName',
    'lastName',
    'bio',
    'specialty',
    'city',
    'state',
    'photoURL',
  ] as const;
  const data: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in body) {
      const v = body[key];
      data[key] = v === null || v === undefined ? null : String(v);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      success: true,
      coachId: coach.id,
      coach: serializeCoach(coach),
    });
  }

  const updated = await prisma.coach.update({
    where: { id: coach.id },
    data,
  });

  return NextResponse.json({
    success: true,
    coachId: updated.id,
    coach: serializeCoach(updated),
  });
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
