export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

const AMOUNT_PER_CREDIT_CENTS = 1000; // $10

/**
 * GET /api/me/ambassador-credits
 * For Athlete with role AMBASSADOR: tally and amount earned this period (since last payout).
 * Same pattern as My Work for data-entry staff.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    if (athlete.role !== 'AMBASSADOR') {
      return NextResponse.json(
        { success: true, ambassador: false, tally: 0, amountEarnedCents: 0, periodStart: null, amountPerCreditCents: AMOUNT_PER_CREDIT_CENTS }
      );
    }

    // Period start = processedAt of most recent payout (FK-based, not column on Athlete)
    const lastPayout = await prisma.ambassador_payouts.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { processedAt: 'desc' },
      select: { processedAt: true },
    });
    const periodStart = lastPayout?.processedAt ?? null;

    const tally = await prisma.ambassador_credits.count({
      where: {
        athleteId: athlete.id,
        ...(periodStart ? { createdAt: { gt: periodStart } } : {}),
      },
    });

    const amountEarnedCents = tally * AMOUNT_PER_CREDIT_CENTS;

    return NextResponse.json({
      success: true,
      ambassador: true,
      tally,
      amountEarnedCents,
      amountEarnedDollars: Math.round(amountEarnedCents) / 100,
      periodStart: periodStart?.toISOString() ?? null,
      amountPerCreditCents: AMOUNT_PER_CREDIT_CENTS,
    });
  } catch (err) {
    console.error('GET /api/me/ambassador-credits:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
