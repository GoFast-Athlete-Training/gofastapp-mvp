export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { loadPublicCoachPage } from '@/lib/athlete-coach/athlete-coach-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  if (!handle?.trim()) {
    return NextResponse.json({ success: false, error: 'handle is required' }, { status: 400 });
  }

  const page = await loadPublicCoachPage(handle);
  if (!page) {
    return NextResponse.json({ success: false, error: 'Coach page not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...page });
}
