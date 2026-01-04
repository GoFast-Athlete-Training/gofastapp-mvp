export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { GOFAST_COMPANY_ID } from '@/lib/goFastCompanyConfig';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
      console.log('✅ COMPANY INIT: Token verified for UID:', decodedToken.uid);
    } catch (err: any) {
      console.error('❌ COMPANY INIT: Token verification failed:', err?.message);
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Always use the first company (oldest by createdAt) as the single source of truth
    let company = await prisma.goFastCompany.findUnique({
      where: { id: GOFAST_COMPANY_ID },
    });

    // If company doesn't exist with the configured ID, find the first company by creation date
    if (!company) {
      console.log("⚠️ COMPANY INIT: Configured company ID not found, finding first company by createdAt...");
      company = await prisma.goFastCompany.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      
      if (!company) {
        // Create new company with hardcoded ID if no company exists
        company = await prisma.goFastCompany.create({
          data: {
            id: GOFAST_COMPANY_ID,
            name: 'GoFast',
            slug: 'gofast',
            address: '2604 N. George Mason Dr.',
            city: 'Arlington',
            state: 'VA',
            zip: '22207',
            domain: 'gofastcrushgoals.com',
          },
        });
        console.log('✅ COMPANY INIT: Created new company');
        return NextResponse.json({ success: true, company });
      }
      
      console.log(`⚠️ COMPANY INIT: Using first company (${company.id}) instead of configured ID. Update config to match.`);
    }

    // Update existing company to ensure all fields are correct
    company = await prisma.goFastCompany.update({
      where: { id: company.id },
      data: {
        name: 'GoFast',
        slug: 'gofast',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zip: '22207',
        domain: 'gofastcrushgoals.com',
      },
    });
    console.log('✅ COMPANY INIT: Updated existing company');

    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error('❌ COMPANY INIT: Error:', err);
    return NextResponse.json({ success: false, error: 'Server error', details: err?.message }, { status: 500 });
  }
}

