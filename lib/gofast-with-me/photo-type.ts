export type GoFastWithMePhotoType = 'action' | 'group' | 'portrait' | 'race' | 'other';

export const GOFAST_WITH_ME_PHOTO_TYPE_OPTIONS: {
  value: GoFastWithMePhotoType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'action',
    label: 'Action shot',
    hint: 'You running, training, or on the move — best for the wide page photo.',
  },
  {
    value: 'group',
    label: 'Group photo',
    hint: 'You with your crew or club — works well as the page feature image.',
  },
  {
    value: 'race',
    label: 'Race photo',
    hint: 'Finish line, bib, or race day — great for showing what you are chasing.',
  },
  {
    value: 'portrait',
    label: 'Portrait / headshot',
    hint: 'Use your profile photo for headshots. Only pick this if you want a separate portrait on the page.',
  },
  {
    value: 'other',
    label: 'Other',
    hint: 'Any photo that represents your public page.',
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

/** Wide inset feature photo — not for portrait/headshot treatment. */
export function usesWideFeaturePhotoLayout(
  photoUrl: string | null | undefined,
  photoType: GoFastWithMePhotoType | null | undefined
): boolean {
  if (!photoUrl?.trim()) return false;
  return normalizeGoFastWithMePhotoType(photoType) !== 'portrait';
}
