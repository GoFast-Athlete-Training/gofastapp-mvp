import type { CSSProperties } from 'react';

export const DEFAULT_PHOTO_FOCUS = 50;
export const DEFAULT_PHOTO_ZOOM = 1;
export const MIN_PHOTO_ZOOM = 1;
export const MAX_PHOTO_ZOOM = 3;

export type PhotoFocus = {
  x: number;
  y: number;
};

export function clampPhotoFocus(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_PHOTO_FOCUS;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampPhotoZoom(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_PHOTO_ZOOM;
  return Math.max(MIN_PHOTO_ZOOM, Math.min(MAX_PHOTO_ZOOM, Math.round(value * 100) / 100));
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

export function photoFrameStyle(
  x: number | null | undefined,
  y: number | null | undefined,
  zoom: number | null | undefined
): CSSProperties {
  const focus = normalizePhotoFocus(x, y);
  const z = clampPhotoZoom(zoom);
  return {
    objectPosition: photoFocusObjectPosition(focus),
    transform: `scale(${z})`,
    transformOrigin: `${focus.x}% ${focus.y}%`,
  };
}

export function photoFocusStyle(
  x: number | null | undefined,
  y: number | null | undefined,
  zoom?: number | null | undefined
): CSSProperties {
  return photoFrameStyle(x, y, zoom ?? DEFAULT_PHOTO_ZOOM);
}
