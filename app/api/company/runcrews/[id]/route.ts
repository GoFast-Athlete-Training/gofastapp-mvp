export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// CORS headers for GoFastCompany HQ
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * DELETE /api/company/runcrews/[id]
 *
 * Deletes a specific RunCrew by ID.
 * Called by GoFastCompany HQ for RunCrew management.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing runcrew id',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify Firebase token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: any) {
      console.error('❌ COMPANY RUNCREWS DELETE: Token verification failed:', err?.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const crew = await prisma.run_crews.findUnique({
      where: { id },
    });

    if (!crew) {
      return NextResponse.json(
        {
          success: false,
          error: 'RunCrew not found',
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // Delete the crew (cascade will handle related records)
    await prisma.run_crews.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'RunCrew deleted successfully',
        data: {
          id: crew.id,
          name: crew.name,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('❌ COMPANY RUNCREWS DELETE: Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        details: err?.message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
