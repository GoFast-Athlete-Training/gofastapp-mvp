export const GOFASTWITHME_STUDIO_READY_KEY = 'gofastwithme-studio-ready';

export function readStudioReady(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GOFASTWITHME_STUDIO_READY_KEY) === '1';
}

export function markStudioReady(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GOFASTWITHME_STUDIO_READY_KEY, '1');
}
