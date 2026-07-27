export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/** Deprecated — use invite token flow only. */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      code: 'USE_INVITE_LINK',
      error: 'Open your manager invite link to activate access.',
    },
    { status: 410 }
  );
}
