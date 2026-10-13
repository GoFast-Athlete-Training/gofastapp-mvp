export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AthleteCoachProgramType } from '@prisma/client';
import { requireCoachAthleteFromBearer } from '@/lib/athlete-coach/require-coach-athlete';

function parseProgramType(raw: unknown): AthleteCoachProgramType {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (v === 'RACE_TRAINING' || v === 'GENERAL_TRAINING' || v === 'ONE_ON_ONE') {
    return v as AthleteCoachProgramType;
  }
  return AthleteCoachProgramType.GENERAL_TRAINING;
}

export async function POST(request: Request) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body: {
    name?: string;
    description?: string | null;
    philosophy?: string | null;
    durationWeeks?: number | null;
    type?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }

  const program = await prisma.athlete_coach_programs.create({
    data: {
      athleteId: auth.athlete.id,
      name,
      description: body.description?.trim() || null,
      philosophy: body.philosophy?.trim() || null,
      durationWeeks:
        typeof body.durationWeeks === 'number' && body.durationWeeks > 0
          ? Math.round(body.durationWeeks)
          : null,
      type: parseProgramType(body.type),
    },
    include: { offerings: true },
  });

  return NextResponse.json({ success: true, program });
}
