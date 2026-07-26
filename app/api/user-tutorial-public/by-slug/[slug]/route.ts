export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const COMPANY_BASE =
  process.env.GOFAST_COMPANY_API_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_COMPANY_APP_URL?.replace(/\/$/, '') ||
  'https://gofasthq.gofastcrushgoals.com';

/** Proxy published user tutorials from GoFast Company for athlete Studio hydration. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
    }

    const upstream = await fetch(
      `${COMPANY_BASE}/api/user-tutorial-public/by-slug/${encodeURIComponent(slug.trim())}`,
      { cache: 'no-store' }
    );

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        data ?? { success: false, error: 'Tutorial not found' },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[user-tutorial-public proxy]', e);
    return NextResponse.json({ success: false, error: 'Failed to fetch tutorial' }, { status: 500 });
  }
}
