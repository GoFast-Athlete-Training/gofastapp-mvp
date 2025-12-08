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

    // Master GoFast Company ID - all athletes are assigned to this company
    const GOFAST_COMPANY_ID = "cmiu1z4dq0000nw4zfzd974uy";

    // Upsert athlete with automatic company assignment
    let athlete;
    try {
      athlete = await prisma.athlete.upsert({
        where: { firebaseId },
        update: {
          // Sync Firebase data on update
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          photoURL: picture || undefined,
          companyId: GOFAST_COMPANY_ID, // Always assign to master GoFast company
        },
        create: {
          firebaseId,
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          photoURL: picture || undefined,
          companyId: GOFAST_COMPANY_ID, // Automatically assign to master GoFast company
        },
      });
      console.log('✅ ATHLETE CREATE: Athlete upserted successfully:', athlete.id);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Prisma upsert failed');
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error message:', err?.message);
      console.error('❌ ATHLETE CREATE: Error meta:', err?.meta);
      throw err; // Re-throw to be caught by outer catch
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
