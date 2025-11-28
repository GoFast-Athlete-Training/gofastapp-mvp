export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Auth unavailable' }, { status: 500 });
    }

        let decodedToken;
        try {
          decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
          console.log('✅ COMPANY INIT: Token verified for UID:', decodedToken.uid);
          console.log('✅ COMPANY INIT: Token project:', decodedToken.firebase?.project_id || 'unknown');
        } catch (err: any) {
          console.error('❌ COMPANY INIT: Token verification failed:', err?.message);
          console.error('❌ COMPANY INIT: Error code:', err?.code);
          return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
        }

    // One-time UPSERT - Guarantee GoFastCompany exists
    const company = await prisma.goFastCompany.upsert({
      where: { slug: 'gofast' },
      update: {},
      create: {
        name: 'GoFast',
        slug: 'gofast',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zip: '22207',
        domain: 'gofastcrushgoals.com',
      },
    });

    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error('❌ COMPANY INIT: Error:', err);
    return NextResponse.json({ success: false, error: 'Server error', details: err?.message }, { status: 500 });
  }
}

