export const GOFASTWITHME_STUDIO_INTRO_DISMISSED_KEY = 'gofastwithme-studio-intro-dismissed';

type GwmIntroRow = {
  creatorType?: string | null;
  welcome?: string | null;
  gofastWithMeBio?: string | null;
} | null;

/** True once the athlete has a persisted gofast_with_me row with creator framing. */
export function hasGoFastWithMeStudioData(row: GwmIntroRow): boolean {
  return Boolean(row?.creatorType);
}

export function shouldShowStudioExplainer(row: GwmIntroRow, introDismissed: boolean): boolean {
  if (!hasGoFastWithMeStudioData(row)) return true;
  return !introDismissed;
}

export function readStudioIntroDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GOFASTWITHME_STUDIO_INTRO_DISMISSED_KEY) === '1';
}

export function dismissStudioIntro(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GOFASTWITHME_STUDIO_INTRO_DISMISSED_KEY, '1');
}
