export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle || !handle.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Handle is required' 
      }, { status: 400 });
    }

    // Verify Firebase token
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

    // Normalize handle
    const normalizedHandle = handle.trim().toLowerCase();

    // Check if handle is already taken
    const existing = await prisma.athlete.findFirst({
      where: {
        gofastHandle: normalizedHandle,
        firebaseId: { not: decodedToken.uid }, // Exclude current user
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      available: !existing,
      handle: normalizedHandle,
    });
  } catch (err: any) {
    console.error('❌ CHECK HANDLE: Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message 
    }, { status: 500 });
  }
}
