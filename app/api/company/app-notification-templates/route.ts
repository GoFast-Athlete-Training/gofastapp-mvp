export const dynamic = 'force-dynamic';

import { listAppNotificationTemplates } from '@/lib/app-notifications/template-store';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/company/app-notification-templates
 * App Management proxies operator CRUD here (staff Bearer + x-gofast-staff-id).
 */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  try {
    const templates = await listAppNotificationTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (err: unknown) {
    console.error('[GET /api/company/app-notification-templates]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 },
    );
  }
}
