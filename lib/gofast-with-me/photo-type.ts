export type GoFastWithMePhotoType = 'action' | 'group' | 'portrait' | 'race' | 'other';

export type GoFastWithMePhotoSurface =
  | 'studioPreview'
  | 'inAppProfile'
  | 'publicLanding'
  | 'previewHero'
  | 'openGraph';

export const GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS: {
  value: GoFastWithMePhotoType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'action',
    label: 'Action shot',
    hint: 'You running or training — wide feature on landing and in the app.',
  },
  {
    value: 'group',
    label: 'Group photo',
    hint: 'You with your crew — wide feature image on public surfaces.',
  },
  {
    value: 'race',
    label: 'Race photo',
    hint: 'Finish line or race day — wide banner-style framing.',
  },
  {
    value: 'portrait',
    label: 'Portrait',
    hint: 'Headshot or posed photo — compact square on page instead of wide banner.',
  },
  {
    value: 'other',
    label: 'Other',
    hint: 'Any photo that represents your page — uses wide framing.',
  },
];

const VALID_TYPES = new Set<string>(GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS.map((o) => o.value));

export function normalizeGoFastWithMePhotoType(
  value: string | null | undefined
): GoFastWithMePhotoType | null {
  const v = value?.trim();
  if (!v || !VALID_TYPES.has(v)) return null;
  return v as GoFastWithMePhotoType;
}

export function photoTypeGuidance(type: GoFastWithMePhotoType | null): string {
  const match = GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS.find((o) => o.value === type);
  return match?.hint ?? 'Choose the photo type that best matches what you are uploading.';
}

export function isPortraitPhotoType(
  photoType: GoFastWithMePhotoType | string | null | undefined
): boolean {
  return normalizeGoFastWithMePhotoType(photoType) === 'portrait';
}

/** Wide inset feature photo — not for portrait treatment. */
export function usesWideFeaturePhotoLayout(
  photoUrl: string | null | undefined,
  photoType: GoFastWithMePhotoType | string | null | undefined
): boolean {
  if (!photoUrl?.trim()) return false;
  return !isPortraitPhotoType(photoType);
}

/** Tailwind aspect ratio for wide frames, per surface (includes mobile where relevant). */
export function widePhotoFrameClass(surface: GoFastWithMePhotoSurface): string {
  switch (surface) {
    case 'studioPreview':
      return 'aspect-[16/7]';
    case 'inAppProfile':
      return 'aspect-[16/9]';
    case 'publicLanding':
      return 'aspect-[4/3] sm:aspect-[16/7]';
    case 'previewHero':
      return 'aspect-[16/9] sm:aspect-[16/7]';
    case 'openGraph':
      return 'aspect-[1200/630]';
    default:
      return 'aspect-[16/9]';
  }
}

export function portraitPhotoWrapClass(surface: GoFastWithMePhotoSurface): string {
  switch (surface) {
    case 'studioPreview':
      return 'flex justify-center';
    case 'inAppProfile':
    case 'publicLanding':
    case 'previewHero':
      return 'flex justify-center';
    default:
      return 'flex justify-center';
  }
}

export function portraitPhotoImageClass(surface: GoFastWithMePhotoSurface): string {
  switch (surface) {
    case 'studioPreview':
      return 'w-36 h-36 rounded-2xl object-cover border border-gray-200 shadow-sm';
    case 'inAppProfile':
      return 'w-32 h-32 rounded-2xl object-cover shadow-md border border-stone-200 bg-white';
    case 'publicLanding':
      return 'w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover shadow-lg border border-sky-100 bg-white';
    case 'previewHero':
      return 'w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover border-4 border-zinc-950 shadow-xl';
    default:
      return 'w-32 h-32 rounded-2xl object-cover';
  }
}

export function widePhotoFrameShellClass(surface: GoFastWithMePhotoSurface): string {
  switch (surface) {
    case 'studioPreview':
      return 'rounded-xl overflow-hidden bg-sky-100 border border-gray-200';
    case 'inAppProfile':
      return 'rounded-2xl overflow-hidden shadow-md bg-sky-100';
    case 'publicLanding':
      return 'rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-sky-100 to-sky-200';
    case 'previewHero':
      return 'rounded-2xl overflow-hidden';
    default:
      return 'rounded-2xl overflow-hidden';
  }
}
