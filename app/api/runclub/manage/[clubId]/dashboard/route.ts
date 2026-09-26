export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderDashboard } from '@/lib/domain-runclub-leader';
import { assertStaffClubManage } from '@/lib/run-club-staff-manage-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const auth = await assertStaffClubManage(request, clubId);
    if (auth.error) return auth.error;

    const dashboard = await getLeaderDashboard(auth.club.id, 'admin');
    if (!dashboard.club) {
      return NextResponse.json({ success: false, error: 'Run club not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...dashboard,
    });
  } catch (error: unknown) {
    console.error('[GET staff manage dashboard]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load club dashboard',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
