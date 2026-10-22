export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { resolveCityRunIdBySegment } from '@/lib/city-run-resolve-segment';
import { publicNameEmailCityRunRsvp } from '@/lib/city-run/public-name-rsvp';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    process.env.NEXT_PUBLIC_GOFAST_LINKS_URL?.replace(/\/$/, '') ||
    'https://gofastlinks.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/runs/public/[runId]/rsvp
 * Public name + email RSVP (no Firebase). Used by join explainer + public run flows.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const segment = ((await params).runId || '').trim();
    if (!segment) {
      return NextResponse.json(
        { success: false, error: 'Missing run id' },
        { status: 400, headers: corsHeaders },
      );
    }
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) {
      return NextResponse.json(
        { success: false, error: 'CityRun not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    let body: { name?: string; email?: string; displayName?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders },
      );
    }

    const displayName = (body.displayName ?? body.name ?? '').trim();
    const email = (body.email ?? '').trim();
    if (!displayName || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const result = await publicNameEmailCityRunRsvp({
      runId: resolvedId,
      displayName,
      email,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        alreadyOnRun: result.alreadyOnRun,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('public name RSVP error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
