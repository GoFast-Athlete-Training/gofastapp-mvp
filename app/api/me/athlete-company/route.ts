export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  getAthleteCompanyForAthlete,
  upsertAthleteCompanyForAthlete,
} from '@/lib/athlete-company/athlete-company-service';

/** GET /api/me/athlete-company — own athlete-owned business row */
export async function GET(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const company = await getAthleteCompanyForAthlete(auth.athlete.id);
    return NextResponse.json({ success: true, company });
  } catch (e) {
    console.error('GET /api/me/athlete-company', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/** PATCH /api/me/athlete-company — create or update athlete-owned business */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      name?: string;
      logoUrl?: string | null;
      websiteUrl?: string | null;
    };

    if (body.name == null || String(body.name).trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Business name is required' },
        { status: 400 }
      );
    }

    const company = await upsertAthleteCompanyForAthlete(auth.athlete.id, {
      name: String(body.name),
      logoUrl: body.logoUrl,
      websiteUrl: body.websiteUrl,
    });

    return NextResponse.json({ success: true, company });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error('PATCH /api/me/athlete-company', e);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
