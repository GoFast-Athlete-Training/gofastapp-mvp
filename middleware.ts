import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export type OnboardingIntent = 'CLUB_LEADER' | 'ATHLETE';

const ONBOARDING_INTENT_COOKIE = 'onboarding_intent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Detect onboarding intent from hostname
 * - If hostname starts with "leader." → CLUB_LEADER
 * - Otherwise → ATHLETE
 */
function detectOnboardingIntent(hostname: string): OnboardingIntent {
  // Remove port if present (e.g., "leader.localhost:3000" -> "leader.localhost")
  const hostWithoutPort = hostname.split(':')[0];
  
  // Check if hostname starts with "leader."
  if (hostWithoutPort.startsWith('leader.')) {
    return 'CLUB_LEADER';
  }
  
  return 'ATHLETE';
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const intent = detectOnboardingIntent(hostname);
  
  // Get existing intent cookie
  const existingIntent = request.cookies.get(ONBOARDING_INTENT_COOKIE)?.value;
  
  // Only set cookie if it doesn't exist or has changed
  // This prevents unnecessary cookie updates on every request
  if (existingIntent !== intent) {
    const response = NextResponse.next();
    
    // Set cookie with intent
    response.cookies.set(ONBOARDING_INTENT_COOKIE, intent, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false, // Allow client-side access for redirects
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
