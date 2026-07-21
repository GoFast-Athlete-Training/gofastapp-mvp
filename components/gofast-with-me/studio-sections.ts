import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';

export type StudioSection = 'welcome' | 'configure' | 'content' | 'manage';

export const STUDIO_SECTION_LABELS: Record<StudioSection, string> = {
  welcome: 'Landing Page',
  configure: 'Configure',
  content: 'General Content',
  manage: 'Manage',
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

export function defaultStudioSection(
  values: GoFastWithMeLandingValues,
  explicitHash: string | null
): StudioSection {
  const fromHash = explicitHash ? parseStudioSectionFromHash(explicitHash) : null;
  if (fromHash) return fromHash;
  return isWelcomeContentComplete(values) ? 'configure' : 'welcome';
}
