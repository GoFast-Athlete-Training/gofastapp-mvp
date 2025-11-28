// ⛔ Prevent static evaluation (this is 100% required)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    // 1️⃣ Read body safely
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 2️⃣ Safe server auth guard
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('⚠️ Firebase Admin not initialized – create route unavailable.');
      return NextResponse.json(
        { error: 'Auth unavailable' },
        { status: 500 }
      );
    }

    // 3️⃣ Extract token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // 4️⃣ Verify token safely
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('❌ Token verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const firebaseId = decoded.uid;

    // 5️⃣ Create Athlete in DB
    const athlete = await prisma.athlete.create({
      data: {
        firebaseId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
      },
    });

    return NextResponse.json({ athlete });
  } catch (err: any) {
    console.error('❌ Athlete CREATE error:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}
