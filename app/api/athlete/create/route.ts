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

    // Parse displayName into firstName/lastName if available
    const firstName = displayName?.split(' ')[0] || null;
    const lastName = displayName?.split(' ').slice(1).join(' ') || null;

    // Step 1: Resolve Canonical Company (DB Source of Truth)
    const company = await prisma.goFastCompany.findFirst();
    if (!company) {
      console.error("❌ ATHLETE CREATE: No GoFastCompany found");
      throw new Error("No GoFastCompany found. Athlete creation requires a company.");
    }
    console.log('✅ ATHLETE CREATE: Using company:', company.id, company.name || company.slug);

    console.log('🔍 ATHLETE CREATE: Looking up athlete with firebaseId:', firebaseId);

    // First check if athlete exists by firebaseId
    // NOTE: After DB switch, Firebase users may exist but have no DB records
    let existing = await prisma.athlete.findUnique({
      where: { firebaseId },
    });

    // If not found by firebaseId, check by email (handles case where Firebase user was recreated)
    // Note: email is not unique in schema, so use findFirst
    if (!existing && email) {
      console.log('🔍 ATHLETE CREATE: Not found by firebaseId, checking by email:', email);
      existing = await prisma.athlete.findFirst({
        where: { email },
      });
      
      if (existing) {
        console.log('⚠️ ATHLETE CREATE: Found athlete by email with different firebaseId. Updating firebaseId to match current Firebase user.');
      }
    }

    let athlete;
    if (existing) {
      console.log('✅ ATHLETE CREATE: Athlete exists in DB, updating:', existing.id);
      // Update existing athlete - sync Firebase data and update firebaseId if different
      const updateData: any = {};
      
      // CRITICAL: Update firebaseId if it's different (handles Firebase user recreation)
      if (existing.firebaseId !== firebaseId) {
        updateData.firebaseId = firebaseId;
        console.log('🔄 ATHLETE CREATE: Updating firebaseId from', existing.firebaseId, 'to', firebaseId);
      }
      
      // Sync Firebase data on update
      if (email) updateData.email = email;
      if (firstName !== undefined) updateData.firstName = firstName || null;
      if (lastName !== undefined) updateData.lastName = lastName || null;
      if (picture !== undefined) updateData.photoURL = picture || null;
      
      // companyId is always derived from GoFastCompany (ultra container)
      updateData.companyId = company.id;

      // Use the existing athlete's unique identifier for the update
      const whereClause = existing.firebaseId === firebaseId 
        ? { firebaseId } 
        : { id: existing.id };

      athlete = await prisma.athlete.update({
        where: whereClause,
        data: updateData,
      });
      console.log('✅ ATHLETE CREATE: Athlete updated successfully:', athlete.id);
    } else {
      // Firebase user exists but no DB record (common after DB switch without migration)
      console.log('🆕 ATHLETE CREATE: No DB record found for Firebase user. Creating new athlete record.');
      console.log('   This is expected after DB switch - Firebase user exists but DB record doesn\'t.');
      // Create new athlete - automatically assign to GoFast company
      // companyId is always derived from GoFastCompany (ultra container)
      athlete = await prisma.athlete.create({
        data: {
          firebaseId,
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          photoURL: picture || undefined,
          companyId: company.id,
        },
      });
      console.log('✅ ATHLETE CREATE: New athlete record created successfully:', athlete.id);
    }

    // Format response like MVP1
    return NextResponse.json({
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
