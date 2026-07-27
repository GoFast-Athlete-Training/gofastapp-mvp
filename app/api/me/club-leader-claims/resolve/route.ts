export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Deprecated — manager access resolves only via invite token (/club-manager/activate).
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      code: 'USE_INVITE_LINK',
      error: 'Open your manager invite link to activate access. Email match alone is not supported.',
    },
    { status: 410 }
  );
}
