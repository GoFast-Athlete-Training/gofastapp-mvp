import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * DELETE /api/run-series/delete-by-slug?slug=...
 * Removes prod run_series by slug. city_runs.runSeriesId → null (FK onDelete: SetNull).
 * Auth: Firebase Bearer (staff / Company server-to-server with forwarded token).
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const slug = new URL(request.url).searchParams.get('slug')?.trim();
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Missing slug query parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    const series = await prisma.run_series.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!series) {
      const res = NextResponse.json({
        success: true,
        deleted: false,
        slug,
        orphanedRunCount: 0,
        message: 'No run_series with this slug',
      });
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const orphanCount = await prisma.city_runs.count({
      where: { runSeriesId: series.id },
    });

    await prisma.run_series.delete({ where: { id: series.id } });

    const res = NextResponse.json({
      success: true,
      deleted: true,
      slug,
      orphanedRunCount: orphanCount,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[DELETE /api/run-series/delete-by-slug]', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete run_series' },
      { status: 500, headers: corsHeaders }
    );
  }
}
