export const DEFAULT_PHOTO_FOCUS = 50;

export type PhotoFocus = {
  x: number;
  y: number;
};

export function clampPhotoFocus(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_PHOTO_FOCUS;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizePhotoFocus(
  x: number | null | undefined,
  y: number | null | undefined
): PhotoFocus {
  return {
    x: clampPhotoFocus(x),
    y: clampPhotoFocus(y),
  };
}

export function photoFocusObjectPosition(focus: PhotoFocus): string {
  return `${focus.x}% ${focus.y}%`;
}

export function photoFocusStyle(
  x: number | null | undefined,
  y: number | null | undefined
): { objectPosition: string } {
  return { objectPosition: photoFocusObjectPosition(normalizePhotoFocus(x, y)) };
}
