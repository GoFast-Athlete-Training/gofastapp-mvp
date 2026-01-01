// Server-side cookie utilities for Phase 1 refactor
import { cookies } from 'next/headers';

const ATHLETE_ID_COOKIE = 'athleteId';

/**
 * Get athleteId from cookie
 * Returns null if cookie doesn't exist or is invalid
 */
export async function getAthleteIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const athleteIdCookie = cookieStore.get(ATHLETE_ID_COOKIE);
  return athleteIdCookie?.value || null;
}

/**
 * Set athleteId cookie
 */
export async function setAthleteIdCookie(athleteId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ATHLETE_ID_COOKIE, athleteId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });
}

/**
 * Clear athleteId cookie
 */
export async function clearAthleteIdCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ATHLETE_ID_COOKIE);
}

