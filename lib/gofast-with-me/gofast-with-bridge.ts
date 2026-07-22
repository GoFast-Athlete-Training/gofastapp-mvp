import { getGoFastAppPublicUrl } from '@/lib/gofast-app-public-url';
import { goFastWithPersonHeadline } from '@/lib/gofast-with-me/resolve-public-actions';

export type GoFastWithTarget = {
  hostAthleteId: string;
  slug: string;
  displayName: string;
  firstName: string | null;
  gofastHandle: string | null;
  photoURL: string | null;
};

export function resolvePublicSlug(
  gofastSlugSnapshot: string | null | undefined,
  gofastHandle: string | null | undefined,
  pageHandle?: string | null
): string | null {
  const slug = gofastSlugSnapshot?.trim() || gofastHandle?.trim() || pageHandle?.trim();
  return slug || null;
}

export function goFastWithFrontDoorPath(slug: string): string {
  return `/gofast-with/${encodeURIComponent(slug)}`;
}

export function goFastWithSignupPath(slug: string): string {
  return `/gofast-with/${encodeURIComponent(slug)}/signup`;
}

export function goFastWithConfirmPath(slug: string): string {
  return `/gofast-with/${encodeURIComponent(slug)}/confirm`;
}

export function goFastWithFrontDoorUrl(slug: string, appBase?: string): string {
  const base = (appBase ?? getGoFastAppPublicUrl()).replace(/\/$/, '');
  return `${base}${goFastWithFrontDoorPath(slug)}`;
}

export function headlineForTarget(target: Pick<GoFastWithTarget, 'firstName' | 'displayName'>): string {
  return goFastWithPersonHeadline(target.firstName, target.displayName);
}

export function getAppOpenUrl(): string {
  return getGoFastAppPublicUrl().replace(/\/$/, '') || '/welcome';
}
