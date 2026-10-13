export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoachAthleteFromBearer } from '@/lib/athlete-coach/require-coach-athlete';

export async function POST(request: Request) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body: {
    coachProgramId?: string;
    name?: string;
    whatYouGet?: string | null;
    priceCents?: number | null;
    priceDisplay?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const programId = body.coachProgramId?.trim();
  const name = body.name?.trim();
  if (!programId || !name) {
    return NextResponse.json(
      { success: false, error: 'coachProgramId and name are required' },
      { status: 400 }
    );
  }

  const program = await prisma.athlete_coach_programs.findFirst({
    where: { id: programId, athleteId: auth.athlete.id },
  });
  if (!program) {
    return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 });
  }

  const offering = await prisma.athlete_coach_offerings.create({
    data: {
      coachProgramId: programId,
      name,
      whatYouGet: body.whatYouGet?.trim() || null,
      priceCents:
        typeof body.priceCents === 'number' && body.priceCents >= 0
          ? Math.round(body.priceCents)
          : null,
      priceDisplay: body.priceDisplay?.trim() || null,
    },
  });

  return NextResponse.json({ success: true, offering });
}
