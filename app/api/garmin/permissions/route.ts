export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { handlePermissionChange } from '@/lib/garmin-events/handlePermissionChange';

/**
 * PUT/POST /api/garmin/permissions
 * USER_PERMISSION_CHANGED — acknowledge immediately, then sync permissions from Garmin API.
 */
async function acknowledgeAndProcess(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  void handlePermissionChange(body as Parameters<typeof handlePermissionChange>[0]).catch(
    (err) => console.error('Garmin permissions async error:', err)
  );
  return new NextResponse(null, { status: 200 });
}

export async function PUT(request: Request) {
  return acknowledgeAndProcess(request);
}

export async function POST(request: Request) {
  return acknowledgeAndProcess(request);
}
