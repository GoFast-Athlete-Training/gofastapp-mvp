export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AthleteCoachProgramType } from '@prisma/client';
import { requireCoachAthleteFromBearer } from '@/lib/athlete-coach/require-coach-athlete';

async function ownedProgram(athleteId: string, programId: string) {
  return prisma.athlete_coach_programs.findFirst({
    where: { id: programId, athleteId },
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
  const existing = await ownedProgram(auth.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const program = await prisma.athlete_coach_programs.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name.trim() || existing.name } : {}),
      ...(body.description !== undefined
        ? { description: typeof body.description === 'string' ? body.description.trim() || null : null }
        : {}),
      ...(body.philosophy !== undefined
        ? { philosophy: typeof body.philosophy === 'string' ? body.philosophy.trim() || null : null }
        : {}),
      ...(body.durationWeeks !== undefined
        ? {
            durationWeeks:
              typeof body.durationWeeks === 'number' && body.durationWeeks > 0
                ? Math.round(body.durationWeeks)
                : null,
          }
        : {}),
      ...(typeof body.type === 'string' &&
      ['RACE_TRAINING', 'GENERAL_TRAINING', 'ONE_ON_ONE'].includes(body.type.toUpperCase())
        ? { type: body.type.toUpperCase() as AthleteCoachProgramType }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
    include: { offerings: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json({ success: true, program });
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
  const existing = await ownedProgram(auth.athlete.id, id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 });
  }

  await prisma.athlete_coach_programs.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
