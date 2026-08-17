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
