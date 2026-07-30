/** Canonical public host for club manager activation (dedicated subdomain). */
export const CLUB_MANAGER_PRODUCTION_URL = 'https://clubmanage.gofastcrushgoals.com';

/** Resolve the base URL used in manager invite activation links. */
export function getClubManagerAppUrl(): string {
  const fromEnv =
    process.env.CLUB_MANAGER_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_CLUB_MANAGER_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return CLUB_MANAGER_PRODUCTION_URL;
  }

  return (
    process.env.NEXT_PUBLIC_GOFAST_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3001'
  );
}
