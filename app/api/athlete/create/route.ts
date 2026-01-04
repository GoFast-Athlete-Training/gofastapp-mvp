export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { GOFAST_COMPANY_ID } from '@/lib/goFastCompanyConfig';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ ATHLETE CREATE: Missing or invalid auth header');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 ATHLETE CREATE: Received token (first 20 chars):', token.substring(0, 20) + '...');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('✅ ATHLETE CREATE: Token verified for UID:', decodedToken.uid);
      console.log('✅ ATHLETE CREATE: Token project:', decodedToken.firebase?.project_id || 'unknown');
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Token verification failed');
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error message:', err?.message);
      console.error('❌ ATHLETE CREATE: Error name:', err?.name);
      
      // Check if it's a Firebase Admin initialization error
      if (err?.message?.includes('Firebase Admin env vars missing') || err?.message?.includes('Firebase Admin')) {
        console.error('❌ ATHLETE CREATE: Firebase Admin initialization failed');
        console.error('❌ ATHLETE CREATE: Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
        return NextResponse.json({ 
          success: false, 
          error: 'Firebase Admin initialization failed',
          details: err?.message || 'Check Firebase environment variables'
        }, { status: 500 });
      }
      
      console.error('❌ ATHLETE CREATE: Token (first 50 chars):', token.substring(0, 50));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        details: err?.message || 'Token verification failed'
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    const displayName = decodedToken.name || undefined;
    const picture = decodedToken.picture || undefined;
    
    console.log('👤 ATHLETE CREATE: Firebase token name:', displayName || 'missing');
    console.log('📸 ATHLETE CREATE: Firebase token picture:', picture ? 'present' : 'missing');
    if (picture) {
      console.log('📸 ATHLETE CREATE: Picture URL:', picture.substring(0, 50) + '...');
    }
    
    // Log all available token fields for debugging
    console.log('🔍 ATHLETE CREATE: Available token fields:', Object.keys(decodedToken).filter(k => ['name', 'email', 'picture', 'displayName'].includes(k)));

    // Parse displayName into firstName/lastName if available
    const firstName = displayName?.split(' ')[0] || null;
    const lastName = displayName?.split(' ').slice(1).join(' ') || null;
    
    console.log('👤 ATHLETE CREATE: Parsed firstName:', firstName);
    console.log('👤 ATHLETE CREATE: Parsed lastName:', lastName);

    // Step 1: Resolve Canonical Company (Pin to First Company)
    // Always use the first company (oldest by createdAt) as the single source of truth
    let company = await prisma.goFastCompany.findUnique({
      where: { id: GOFAST_COMPANY_ID },
    });
    
    // If company doesn't exist with the configured ID, find the first company by creation date
    if (!company) {
      console.log("⚠️ ATHLETE CREATE: Configured company ID not found, finding first company by createdAt...");
      company = await prisma.goFastCompany.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      
      if (!company) {
        throw new Error("No GoFastCompany found. Please run setup script or check database migrations.");
      }
      
      console.log(`⚠️ ATHLETE CREATE: Using first company (${company.id}) instead of configured ID. Update config to match.`);
    }
    
    console.log('✅ ATHLETE CREATE: Using company:', company.id, company.name || company.slug);

    console.log('🔍 ATHLETE CREATE: Looking up athlete with firebaseId:', firebaseId);

    // Use upsert pattern to atomically handle create/update and prevent race conditions
    // This ensures only one athlete record exists per firebaseId
    const updateData: any = {};
    const createData: any = {
      firebaseId,
      companyId: company.id,
    };

    // Sync Firebase data - only include fields that are defined
    if (email !== undefined) {
      updateData.email = email || undefined;
      createData.email = email || undefined;
    }
    // Sync name fields if displayName was present in the token
    // Note: firstName/lastName will be null if displayName was undefined/null
    if (displayName !== undefined) {
      updateData.firstName = firstName || null;
      createData.firstName = firstName || null;
      updateData.lastName = lastName || null;
      createData.lastName = lastName || null;
      console.log('👤 ATHLETE CREATE: Syncing name fields - firstName:', firstName, 'lastName:', lastName);
    } else {
      console.log('👤 ATHLETE CREATE: No displayName in token, skipping name sync');
    }
    if (picture !== undefined) {
      updateData.photoURL = picture || undefined;
      createData.photoURL = picture || undefined;
    }
    // companyId is always derived from GoFastCompany (ultra container)
    updateData.companyId = company.id;

    const athlete = await prisma.athlete.upsert({
      where: { firebaseId },
      update: updateData,
      create: createData,
    });

    if (athlete.firebaseId === firebaseId && athlete.companyId === company.id) {
      console.log('✅ ATHLETE CREATE: Athlete record synced successfully:', athlete.id);
    } else {
      console.log('✅ ATHLETE CREATE: New athlete record created successfully:', athlete.id);
    }

    // Format response like MVP1
    const response = NextResponse.json({
      success: true,
      message: 'Athlete found or created',
      athleteId: athlete.id,
      data: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gofastHandle: athlete.gofastHandle,
        birthday: athlete.birthday,
        gender: athlete.gender,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        instagram: athlete.instagram,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
      },
    });

    return response;
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    console.error('❌ ATHLETE CREATE: Error code:', err?.code);
    console.error('❌ ATHLETE CREATE: Error name:', err?.name);
    console.error('❌ ATHLETE CREATE: Error stack:', err?.stack);
    
    // Check for table doesn't exist error (P2021)
    if (err?.code === 'P2021') {
      console.error('❌ ATHLETE CREATE: Database table does not exist');
      console.error('❌ ATHLETE CREATE: Table:', err?.meta?.table);
      console.error('❌ ATHLETE CREATE: This usually means migrations need to be run');
      return NextResponse.json({ 
        success: false, 
        error: 'Database table does not exist',
        details: `Table ${err?.meta?.table || 'Athlete'} does not exist. Please run database migrations: npx prisma db push or npx prisma migrate deploy`,
        code: err?.code,
        table: err?.meta?.table
      }, { status: 500 });
    }
    
    // Check for Prisma unique constraint violations (email already exists)
    if (err?.code === 'P2002') {
      console.error('❌ ATHLETE CREATE: Unique constraint violation');
      console.error('❌ ATHLETE CREATE: Meta:', err?.meta);
      return NextResponse.json({ 
        success: false, 
        error: 'Email already exists',
        details: err?.meta?.target ? `Field ${err.meta.target.join(', ')} already exists` : err?.message
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message || 'Unknown error',
      code: err?.code
    }, { status: 500 });
  }
}
