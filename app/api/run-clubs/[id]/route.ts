import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/run-clubs/[id]
 * 
 * Fetch a run club with all its run_series (backwards compatible hydration)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;

    const runClub = await prisma.run_clubs.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        allRunsDescription: true,
        runSchedule: true, // Include runSchedule
        runUrl: true,
        logoUrl: true,
        state: true,
        neighborhood: true,
        websiteUrl: true,
        instagramUrl: true,
        stravaUrl: true,
        runSeries: {
          select: {
            id: true,
            slug: true,
            name: true,
            dayOfWeek: true,
            description: true,
            workflowStatus: true,
            startTimeHour: true,
            startTimeMinute: true,
            startTimePeriod: true,
            meetUpPoint: true,
            meetUpCity: true,
            stravaUrl: true,
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!runClub) {
      return NextResponse.json(
        { success: false, error: 'Run club not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const response = NextResponse.json({
      success: true,
      runClub: {
        ...runClub,
        runSeries: runClub.runSeries || [],
      },
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[run-clubs GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch run club' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/run-clubs/[id]
 * 
 * Update a run club (simple CRUD update)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;
    const body = await request.json();

    // Extract fields to update
    const updateData: any = {};
    if (body.allRunsDescription !== undefined) {
      const trimmed = body.allRunsDescription?.trim() || null;
      updateData.allRunsDescription = trimmed && trimmed.length > 0 ? trimmed : null;
    }
    if (body.name !== undefined) updateData.name = body.name?.trim() || null;
    if (body.city !== undefined) updateData.city = body.city?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl?.trim() || null;
    if (body.runUrl !== undefined) updateData.runUrl = body.runUrl?.trim() || null;
    if (body.stravaUrl !== undefined) updateData.stravaUrl = body.stravaUrl?.trim() || null;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl?.trim() || null;
    if (body.runSchedule !== undefined) {
      const trimmed = body.runSchedule?.trim() ?? '';
      updateData.runSchedule = trimmed.length > 0 ? trimmed : null;
    }

    console.log('🔄 PUT: Updating run_clubs:', {
      id,
      updateData,
      allRunsDescription: updateData.allRunsDescription ? `${updateData.allRunsDescription.substring(0, 50)}...` : null,
    });

    const runClub = await prisma.run_clubs.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        allRunsDescription: true,
        runSchedule: true,
      },
    });

    console.log('✅ PUT: Successfully updated run_clubs:', {
      id: runClub.id,
      allRunsDescription: runClub.allRunsDescription ? `${runClub.allRunsDescription.substring(0, 50)}...` : null,
    });

    const response = NextResponse.json({
      success: true,
      runClub,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[run-clubs PUT] Error:', error);
    
    // Handle Prisma not found error
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Run club not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update run club' },
      { status: 500, headers: corsHeaders }
    );
  }
}
