import { cookies } from 'next/headers';
import type { OnboardingIntent } from '@/middleware';

const ONBOARDING_INTENT_COOKIE = 'onboarding_intent';

/**
 * Get onboarding intent from cookie (server-side)
 */
export async function getOnboardingIntent(): Promise<OnboardingIntent> {
  const cookieStore = await cookies();
  const intent = cookieStore.get(ONBOARDING_INTENT_COOKIE)?.value;
  
  // Default to ATHLETE if not set
  return (intent === 'CLUB_LEADER' ? 'CLUB_LEADER' : 'ATHLETE') as OnboardingIntent;
}

/**
 * Get onboarding intent from cookie (client-side)
 */
export function getOnboardingIntentClient(): OnboardingIntent {
  if (typeof document === 'undefined') {
    return 'ATHLETE';
  }
  
  const cookies = document.cookie.split(';');
  const intentCookie = cookies.find(c => c.trim().startsWith(`${ONBOARDING_INTENT_COOKIE}=`));
  
  if (intentCookie) {
    const value = intentCookie.split('=')[1]?.trim();
    if (value === 'CLUB_LEADER') {
      return 'CLUB_LEADER';
    }
  }
  
  return 'ATHLETE';
}

/**
 * Clear onboarding intent cookie (client-side)
 */
export function clearOnboardingIntent(): void {
  if (typeof document === 'undefined') {
    return;
  }
  
  document.cookie = `${ONBOARDING_INTENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
