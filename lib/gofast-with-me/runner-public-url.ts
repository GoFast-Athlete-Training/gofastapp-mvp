import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';

/** Canonical public landing host for GoFast With Me (contentpublic runner deployment). */
export function getRunnerPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, '') ||
    'https://runner.gofastcrushgoals.com'
  );
}

/** Absolute URL for the public landing page on the runner host. */
export function runnerPublicLandingUrl(handle: string, baseUrl?: string): string {
  const slug = normalizeGoFastWithMeSlug(handle);
  const base = (baseUrl ?? getRunnerPublicBaseUrl()).replace(/\/$/, '');
  return `${base}/${encodeURIComponent(slug)}`;
}

/** Absolute URL for a public subpage: domain/slug/segment (e.g. …/adamgofast/story). */
export function runnerPublicSegmentUrl(
  handle: string,
  segment?: string | null,
  baseUrl?: string
): string {
  const landing = runnerPublicLandingUrl(handle, baseUrl).replace(/\/$/, '');
  const seg = segment?.trim().replace(/^\/+/, '');
  if (!seg) return landing;
  return `${landing}/${encodeURIComponent(seg)}`;
}
