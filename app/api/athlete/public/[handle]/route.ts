export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { RunWorkflowStatus } from '@prisma/client';

const PUBLIC_RUN_WORKFLOW: RunWorkflowStatus[] = ['PENDING', 'SUBMITTED', 'APPROVED'];

function normalizeHandle(raw: string): string {
  let h = (raw || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1);
  return h.replace(/[^a-z0-9_]/g, '');
}

/**
 * GET /api/athlete/public/[handle]
 * Public, unauthenticated. Safe fields only. 404 if no athlete with this gofastHandle.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: raw } = await params;
    const handle = normalizeHandle(raw || '');
    if (!handle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const athlete = await prisma.athlete.findUnique({
      where: { gofastHandle: handle },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const now = new Date();

    const upcomingRuns = await prisma.city_runs.findMany({
      where: {
        athleteGeneratedId: athlete.id,
        date: { gte: now },
        workflowStatus: { in: PUBLIC_RUN_WORKFLOW },
      },
      orderBy: { date: 'asc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        gofastCity: true,
        meetUpPoint: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        workoutId: true,
      },
    });

    let trainingSummary: {
      planName: string;
      startDate: string;
      totalWeeks: number;
      raceName: string | null;
    } | null = null;

    const plan = await prisma.training_plans.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        startDate: true,
        totalWeeks: true,
        race_registry: { select: { name: true } },
      },
    });
    if (plan) {
      trainingSummary = {
        planName: plan.name,
        startDate: plan.startDate.toISOString(),
        totalWeeks: plan.totalWeeks,
        raceName: plan.race_registry?.name ?? null,
      };
    }

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const workoutRows = await prisma.workouts.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfToday },
      },
      orderBy: { date: 'asc' },
      take: 12,
      select: {
        id: true,
        title: true,
        workoutType: true,
        date: true,
      },
    });
    const upcomingWorkouts = workoutRows.map((w) => ({
      id: w.id,
      title: w.title,
      workoutType: w.workoutType,
      date: w.date ? w.date.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      athlete: {
        gofastHandle: athlete.gofastHandle,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
      },
      trainingSummary,
      upcomingWorkouts,
      upcomingRuns: upcomingRuns.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        date: r.date.toISOString(),
        gofastCity: r.gofastCity,
        meetUpPoint: r.meetUpPoint,
        startTimeHour: r.startTimeHour,
        startTimeMinute: r.startTimeMinute,
        startTimePeriod: r.startTimePeriod,
        workoutId: r.workoutId,
        gorunPath: `/gorun/${r.id}`,
      })),
    });
  } catch (e: unknown) {
    console.error('GET /api/athlete/public/[handle]:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
