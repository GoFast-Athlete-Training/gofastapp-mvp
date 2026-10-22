import { cityRunTogetherPath } from '@/lib/city-run/run-nav-paths';

export const VIEW_EDIT_LABEL = 'View/Edit';
/** Athlete run surface (RSVP + hub) — canon route `/cityruntogether/{slug}`. */
export const OPEN_RUN_PAGE_LABEL = 'Open run page';

export function hostRunEditHref(cityRunId: string): string {
  return `/host-a-run/${encodeURIComponent(cityRunId.trim())}`;
}

export function hostRunPageHref(slugOrId: string): string {
  return cityRunTogetherPath(slugOrId.trim());
}

export function hostRunPublicSegment(run: { id: string; slug?: string | null }): string {
  return run.slug?.trim() || run.id;
}
