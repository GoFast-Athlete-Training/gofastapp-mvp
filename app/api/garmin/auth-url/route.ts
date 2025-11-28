export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // 2️⃣ Get admin auth (may be null during build)
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('⚠️ Firebase admin not initialized. Skipping auth.');
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
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Generate Garmin OAuth URL
    const clientId = process.env.GARMIN_CLIENT_ID;
    const redirectUri = process.env.GARMIN_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/settings/garmin/callback`;
    
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = `https://connect.garmin.com/oauthConfirm?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.json({ success: true, authUrl, state });
  } catch (err: any) {
    console.error('❌ API ERROR:', err);
    return NextResponse.json(
      { error: 'Server error', detail: err.message },
      { status: 500 }
    );
  }
}
