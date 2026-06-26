export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildPostRunCtaCopy } from '@/lib/city-run-copy';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { evaluateAthleteCtaTriggers } from '@/lib/cta-triggers';

/**
 * GET /api/me/city-run-post-run-cta
 * Returns the latest post-run shout prompt for Home/Runs surfaces.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { athlete } = auth;
    const result = await evaluateAthleteCtaTriggers({
      athleteId: athlete.id,
      source: 'home-read',
    });

    const cta = result.cityRunPostRunShoutCta;
    if (!cta) {
      return NextResponse.json({ success: true, cta: null });
    }

    const copy = buildPostRunCtaCopy({
      cityRunType: cta.cityRunType,
      runClub: cta.runClub,
      runTitle: cta.runTitle,
      runDate: cta.runDate,
      ctaTarget: cta.ctaTarget,
    });

    return NextResponse.json({
      success: true,
      cta: {
        runId: cta.runId,
        runTitle: cta.runTitle,
        runDate: cta.runDate,
        runClub: cta.runClub,
        hasCheckin: cta.hasCheckin,
        checkedInAt: cta.checkedInAt,
        garminLinked: cta.garminLinked,
        activitySummary: cta.activitySummary,
        ctaTarget: cta.ctaTarget,
        headline: copy.headline,
        subline: copy.subline,
        buttonLabel: copy.buttonLabel,
      },
    });
  } catch (err) {
    console.error('GET /api/me/city-run-post-run-cta error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
