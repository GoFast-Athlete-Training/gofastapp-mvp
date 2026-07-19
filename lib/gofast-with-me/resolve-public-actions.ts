import { getGoFastAppPublicUrl } from '@/lib/gofast-app-public-url';

export type PublicAction = {
  label: string;
  href: string;
};

type ResolvePublicActionsInput = {
  isGoFastContainer: boolean;
  gofastHandle: string | null;
  hostFirstName: string | null;
  upcomingRuns: { gorunPath: string; title: string }[];
  publishedPlans: { slug: string; title: string }[];
  joinableGroupTraining: { handle: string } | null;
};

/** Derive join actions from real hydrated modules — no fake CTA config. */
export function resolvePublicActions(input: ResolvePublicActionsInput): PublicAction[] {
  const appBase = getGoFastAppPublicUrl().replace(/\/$/, '');
  const name = input.hostFirstName?.trim() || 'me';
  const actions: PublicAction[] = [];

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

  if (input.isGoFastContainer && input.gofastHandle) {
    actions.push({
      label: `Follow ${name}`,
      href: `${appBase}/container/${encodeURIComponent(input.gofastHandle)}`,
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
