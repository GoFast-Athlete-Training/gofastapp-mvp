import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { processClubRunReminders } from '@/lib/club-run-reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** GET /api/cron/club-run-reminders */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const out = await processClubRunReminders(new Date());
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('club-run-reminders cron:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
