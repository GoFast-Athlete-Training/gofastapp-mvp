export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('Firebase Admin not initialized');
      return NextResponse.json({ error: 'Auth unavailable' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Generate Garmin OAuth URL
    const clientId = process.env.GARMIN_CLIENT_ID;
    const redirectUri = process.env.GARMIN_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/settings/garmin/callback`;
    
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = `https://connect.garmin.com/oauthConfirm?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.json({ success: true, authUrl, state });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
