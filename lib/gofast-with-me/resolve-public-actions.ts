import { getGoFastAppPublicUrl } from '@/lib/gofast-app-public-url';
import {
  goFastWithFrontDoorUrl,
  resolvePublicSlug,
} from '@/lib/gofast-with-me/gofast-with-bridge';

export type PublicAction = {
  label: string;
  href: string;
};

type ResolvePublicActionsInput = {
  /** Public GoFastWithMe slug — GoFast-with CTA when set (page is live). */
  gofastSlugSnapshot: string | null;
  /** Fallback when slug snapshot is empty but page resolved by handle. */
  gofastHandle?: string | null;
  hostFirstName: string | null;
  upcomingRuns: { gorunPath: string; title: string }[];
  publishedPlans: { slug: string; title: string }[];
  joinableGroupTraining: { handle: string } | null;
};

/** Derive join actions from real hydrated modules — no fake CTA config. */
export function resolvePublicActions(input: ResolvePublicActionsInput): PublicAction[] {
  const appBase = getGoFastAppPublicUrl().replace(/\/$/, '');
  const fallbackName = input.hostFirstName?.trim() || 'this runner';
  const actions: PublicAction[] = [];

  const slug = resolvePublicSlug(input.gofastSlugSnapshot, input.gofastHandle);
  if (slug) {
    actions.push({
      label: goFastWithPersonHeadline(input.hostFirstName, fallbackName),
      href: goFastWithFrontDoorUrl(slug, appBase),
    });
  }

  if (input.upcomingRuns.length > 0) {
    const run = input.upcomingRuns[0];
    actions.push({
      label: 'Join my next run',
      href: `${appBase}${run.gorunPath}`,
    });
  }

  if (input.publishedPlans.length > 0) {
    const plan = input.publishedPlans[0];
    actions.push({
      label: 'Join this training plan',
      href: `${appBase}/plans/${encodeURIComponent(plan.slug)}`,
    });
  }

  if (input.joinableGroupTraining?.handle) {
    actions.push({
      label: 'Join group training',
      href: `${appBase}/join/training/${encodeURIComponent(input.joinableGroupTraining.handle)}`,
    });
  }

  return actions;
}

export function publicHeroPhotoUrl(
  gofastWithMePhotoUrl: string | null | undefined,
  legacyMyBestRunPhotoURL: string | null | undefined,
  profilePhotoURL: string | null | undefined
): string | null {
  const gwm = gofastWithMePhotoUrl?.trim();
  if (gwm) return gwm;
  const legacy = legacyMyBestRunPhotoURL?.trim();
  if (legacy) return legacy;
  return profilePhotoURL?.trim() || null;
}

export function goFastWithPersonHeadline(firstName: string | null, fallbackName: string): string {
  const name = firstName?.trim() || fallbackName.trim();
  return name ? `GoFast with ${name}` : 'GoFast';
}
