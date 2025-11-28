export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;

    // Fetch the company (slug: "gofast")
    const company = await prisma.goFastCompany.findUnique({
      where: { slug: 'gofast' },
    });

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 500 });
    }

    // Upsert the athlete with companyId attached
    const athlete = await prisma.athlete.upsert({
      where: { firebaseId },
      update: {},
      create: {
        firebaseId,
        email: email ?? undefined,
        companyId: company.id,
      },
    });

    return NextResponse.json({ success: true, athlete });
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    return NextResponse.json({ success: false, error: 'Server error', details: err?.message }, { status: 500 });
  }
}
