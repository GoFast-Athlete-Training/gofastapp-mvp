export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { handleDeregistration } from '@/lib/garmin-events/handleDeregistration';

/**
 * PUT/POST /api/garmin/deregistration
 * Garmin user revoked access (preferred: PUT per Garmin docs).
 */
async function acknowledgeAndProcess(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  void handleDeregistration(body as Parameters<typeof handleDeregistration>[0]).catch(
    (err) => console.error('Garmin deregistration async error:', err)
  );
  return new NextResponse(null, { status: 200 });
}

export async function PUT(request: Request) {
  return acknowledgeAndProcess(request);
}

export async function POST(request: Request) {
  return acknowledgeAndProcess(request);
}
