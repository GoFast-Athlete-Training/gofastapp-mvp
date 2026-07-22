import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

export type StudioSection = 'welcome' | 'configure' | 'content' | 'manage';

/** Sidebar-visible sections (content is folded under CMS / welcome). */
export const STUDIO_SIDEBAR_SECTIONS: StudioSection[] = ['welcome', 'configure', 'manage'];

export const STUDIO_SECTION_LABELS: Record<StudioSection, string> = {
  welcome: 'GoFastWithMe CMS',
  configure: 'Add My Plan',
  content: 'CMS Content',
  manage: 'Member Manager',
};

export const STUDIO_SECTION_ORDER: StudioSection[] = [
  'welcome',
  'configure',
  'content',
  'manage',
];

const LEGACY_HASH_ALIASES: Record<string, StudioSection> = {
  setup: 'configure',
  members: 'manage',
};

export function parseStudioSectionFromHash(rawHash: string): StudioSection | null {
  const hash = rawHash.replace('#', '').trim();
  if (!hash) return null;
  if (hash in STUDIO_SECTION_LABELS) return hash as StudioSection;
  return LEGACY_HASH_ALIASES[hash] ?? null;
}

export function isWelcomeContentComplete(values: GoFastWithMeLandingValues): boolean {
  return Boolean(
    values.welcome?.trim() &&
      values.gofastWithMeBio?.trim() &&
      values.whatYoullSeeHere?.trim() &&
      values.gofastWithMePhotoUrl?.trim()
  );
}

/** Gate section selection: landing must be complete before plan/member tools. */
export function resolveGatedStudioSection(
  requested: StudioSection | null,
  values: GoFastWithMeLandingValues
): StudioSection {
  const landingComplete = isWelcomeContentComplete(values);

  if (!landingComplete) {
    return 'welcome';
  }

  // General Content is folded under GoFastWithMe CMS (welcome).
  if (requested === 'content') {
    return 'welcome';
  }

  if (requested) {
    return requested;
  }

  return 'configure';
}

export function defaultStudioSection(
  values: GoFastWithMeLandingValues,
  explicitHash: string | null
): StudioSection {
  const fromHash = explicitHash ? parseStudioSectionFromHash(explicitHash) : null;
  return resolveGatedStudioSection(fromHash, values);
}

export function isStudioSectionLocked(
  section: StudioSection,
  values: GoFastWithMeLandingValues
): boolean {
  if (section === 'welcome' || section === 'content') return false;
  return !isWelcomeContentComplete(values);
}
