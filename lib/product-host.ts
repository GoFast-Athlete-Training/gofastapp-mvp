/** Hostname → product surface helpers for multi-subdomain entry. */

export type RootHostIntent = 'coach' | 'club-manager' | 'leader' | 'default';

/** Dedicated Club Manager host: clubmanage.gofastcrushgoals.com */
export const CLUB_MANAGER_FRONT_DOOR = '/welcome-clubmanager';

export function isCoachHostname(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('coach.');
}

export function isLeaderHostname(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('leader.');
}

export function isClubManageHostname(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('clubmanage.');
}

export function resolveRootHostIntent(hostname: string): RootHostIntent {
  if (isCoachHostname(hostname)) return 'coach';
  if (isClubManageHostname(hostname)) return 'club-manager';
  if (isLeaderHostname(hostname)) return 'leader';
  return 'default';
}

/**
 * Root `/` destination by host.
 *
 * Two front doors (do not collapse):
 * - clubmanage.* → Club Manager sign-in /welcome-clubmanager (dedicated fork)
 * - athlete host → /explainer or /welcome; manager membership only surfaces
 *   Club Manager entry inside the athlete shell (not this host fork)
 *
 * Invite activation stays on /club-manager/activate?token=…
 */
export function resolveRootEntryPath(opts: {
  hostname: string;
  isAuthenticated: boolean;
}): string {
  const intent = resolveRootHostIntent(opts.hostname);

  // Dedicated Club Manager host: always the club-manager welcome/sign-back-in door.
  if (intent === 'club-manager') {
    return CLUB_MANAGER_FRONT_DOOR;
  }

  if (intent === 'coach') {
    return opts.isAuthenticated ? '/coach-hub' : '/coach-signup';
  }

  if (opts.isAuthenticated) {
    return '/welcome';
  }

  if (intent === 'leader') {
    return '/signup?intent=club-leader';
  }

  return '/explainer';
}
