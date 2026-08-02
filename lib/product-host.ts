/** Hostname → product surface helpers for multi-subdomain entry. */

export type RootHostIntent = 'coach' | 'club-manager' | 'leader' | 'default';

export function isCoachHostname(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('coach.');
}

export function isLeaderHostname(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('leader.');
}

/** Dedicated Club Manager host: clubmanage.gofastcrushgoals.com */
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
 * Root `/` destination by host + auth.
 * clubmanage.* must never fall through to the athlete explainer.
 */
export function resolveRootEntryPath(opts: {
  hostname: string;
  isAuthenticated: boolean;
}): string {
  const intent = resolveRootHostIntent(opts.hostname);

  if (intent === 'coach') {
    return opts.isAuthenticated ? '/coach-hub' : '/coach-signup';
  }

  if (intent === 'club-manager') {
    return opts.isAuthenticated ? '/club-manager' : '/welcome-clubmanager';
  }

  if (opts.isAuthenticated) {
    return '/welcome';
  }

  if (intent === 'leader') {
    return '/signup?intent=club-leader';
  }

  return '/explainer';
}
