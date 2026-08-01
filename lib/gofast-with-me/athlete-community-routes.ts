import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';
import {
  goFastWithConfirmPath,
  goFastWithFrontDoorPath,
  goFastWithSignupPath,
} from '@/lib/gofast-with-me/gofast-with-bridge';

/** Canonical sections on `/u/{handle}/community`. */
export type AthleteCommunitySection = 'plan' | 'updates' | 'tips' | 'goruns' | 'chatter' | 'followers';

export const ATHLETE_COMMUNITY_SECTIONS: { id: AthleteCommunitySection; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'updates', label: 'Updates' },
  { id: 'tips', label: 'Tips' },
  { id: 'goruns', label: 'GoRuns' },
  { id: 'chatter', label: 'Chatter' },
  { id: 'followers', label: 'Followers' },
];

export function athletePublicPagePath(handle: string): string {
  return `/u/${encodeURIComponent(normalizeGoFastWithMeSlug(handle))}`;
}

export function athleteCommunityPath(
  handle: string,
  section?: AthleteCommunitySection
): string {
  const base = `${athletePublicPagePath(handle)}/community`;
  return section ? `${base}#${section}` : base;
}

export function athleteCommunityPreviewPath(handle: string): string {
  return `${athleteCommunityPath(handle)}?preview=follower`;
}

/** Legacy `/container/{handle}` hash → canonical community section. */
const LEGACY_CONTAINER_HASH_MAP: Record<string, AthleteCommunitySection> = {
  'plan-strip': 'plan',
  plan: 'plan',
  messages: 'updates',
  updates: 'updates',
  tips: 'tips',
  thinking: 'tips',
  feed: 'chatter',
  chatter: 'chatter',
  runs: 'goruns',
  goruns: 'goruns',
  followers: 'followers',
};

export function mapLegacyContainerHash(hash: string | null | undefined): AthleteCommunitySection | null {
  if (!hash) return null;
  const key = hash.replace(/^#/, '').trim();
  return LEGACY_CONTAINER_HASH_MAP[key] ?? null;
}

export function legacyContainerRedirectTarget(
  handle: string,
  hash?: string | null,
  search?: string | null
): string {
  const section = mapLegacyContainerHash(hash ?? null);
  const base = athleteCommunityPath(handle, section ?? undefined);
  if (search?.trim()) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return `${base}${params.toString() ? `?${params.toString()}` : ''}`;
  }
  return base;
}

export { goFastWithFrontDoorPath, goFastWithSignupPath, goFastWithConfirmPath };
