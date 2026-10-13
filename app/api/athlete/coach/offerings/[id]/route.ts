export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoachAthleteFromBearer } from '@/lib/athlete-coach/require-coach-athlete';

async function ownedOffering(athleteId: string, offeringId: string) {
  return prisma.athlete_coach_offerings.findFirst({
    where: {
      id: offeringId,
      program: { athleteId },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await ownedOffering(auth.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Offering not found' }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const offering = await prisma.athlete_coach_offerings.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name.trim() || existing.name } : {}),
      ...(body.whatYouGet !== undefined
        ? {
            whatYouGet:
              typeof body.whatYouGet === 'string' ? body.whatYouGet.trim() || null : null,
          }
        : {}),
      ...(body.priceCents !== undefined
        ? {
            priceCents:
              typeof body.priceCents === 'number' && body.priceCents >= 0
                ? Math.round(body.priceCents)
                : null,
          }
        : {}),
      ...(body.priceDisplay !== undefined
        ? {
            priceDisplay:
              typeof body.priceDisplay === 'string' ? body.priceDisplay.trim() || null : null,
          }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });

  return NextResponse.json({ success: true, offering });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await ownedOffering(auth.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Offering not found' }, { status: 404 });
  }

  await prisma.athlete_coach_offerings.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
