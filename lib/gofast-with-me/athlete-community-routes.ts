import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';
import {
  goFastWithConfirmPath,
  goFastWithFrontDoorPath,
  goFastWithSignupPath,
} from '@/lib/gofast-with-me/gofast-with-bridge';

/** Canonical deep-link sections on `/u/{handle}/community`. */
export type AthleteCommunitySection = 'plan' | 'updates' | 'tips' | 'goruns' | 'chatter' | 'followers';

/**
 * Hub tabs (RunCrew / Race Hub pattern). Deep-link sections map into these.
 * Journey leads — weekly update, training-for, next run / join-me, tips — then Chatter.
 */
export type AthleteCommunityHubTab = 'journey' | 'runs' | 'people' | 'chatter';

export const ATHLETE_COMMUNITY_SECTIONS: { id: AthleteCommunitySection; label: string }[] = [
  { id: 'updates', label: 'Weekly message' },
  { id: 'plan', label: 'Plan' },
  { id: 'tips', label: 'Tips' },
  { id: 'goruns', label: 'GoRuns' },
  { id: 'followers', label: 'Followers' },
  { id: 'chatter', label: 'Chatter' },
];

export const ATHLETE_COMMUNITY_HUB_TABS: { id: AthleteCommunityHubTab; label: string }[] = [
  { id: 'journey', label: 'Journey' },
  { id: 'runs', label: 'Runs' },
  { id: 'people', label: 'People' },
  { id: 'chatter', label: 'Chatter' },
];

/** Primary hash written when a hub tab is selected. */
export const ATHLETE_COMMUNITY_TAB_PRIMARY_SECTION: Record<
  AthleteCommunityHubTab,
  AthleteCommunitySection
> = {
  journey: 'updates',
  runs: 'goruns',
  people: 'followers',
  chatter: 'chatter',
};

export function athleteCommunitySectionToHubTab(
  section: AthleteCommunitySection | null | undefined
): AthleteCommunityHubTab {
  switch (section) {
    case 'goruns':
      return 'runs';
    case 'followers':
      return 'people';
    case 'chatter':
      return 'chatter';
    case 'plan':
    case 'updates':
    case 'tips':
    default:
      return 'journey';
  }
}

export function parseAthleteCommunitySection(hash: string): AthleteCommunitySection | null {
  const value = hash.replace(/^#/, '').trim();
  if (
    value === 'plan' ||
    value === 'updates' ||
    value === 'tips' ||
    value === 'goruns' ||
    value === 'chatter' ||
    value === 'followers'
  ) {
    return value;
  }
  // Hub tab ids also accepted as hashes.
  if (value === 'journey') return 'plan';
  if (value === 'runs') return 'goruns';
  if (value === 'people') return 'followers';
  return null;
}

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
