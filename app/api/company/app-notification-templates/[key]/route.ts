export const dynamic = 'force-dynamic';

import {
  getAppNotificationTemplateByKey,
  updateAppNotificationTemplate,
} from '@/lib/app-notifications/template-store';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ key: string }> };

/**
 * GET /api/company/app-notification-templates/[key]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    const template = await getAppNotificationTemplateByKey(decodedKey);
    if (!template) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    console.error('[GET /api/company/app-notification-templates/[key]]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load template' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/company/app-notification-templates/[key]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  try {
    const existing = await getAppNotificationTemplateByKey(decodedKey);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      title?: string;
      body?: string;
      isActive?: boolean;
    };

    const template = await updateAppNotificationTemplate(decodedKey, {
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.body === 'string' ? { body: body.body } : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
    });

    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    console.error('[PUT /api/company/app-notification-templates/[key]]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
      { status: 500 },
    );
  }
}
