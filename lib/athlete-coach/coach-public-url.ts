import { normalizeGoFastWithMeSlug } from '@/lib/gofast-with-me/gofast-with-me-url-service';

/** Contentpublic coaching page base (same host as runner or dedicated content URL). */
export function getCoachPublicBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'https://runner.gofastcrushgoals.com';
}

export function coachPublicLandingUrl(handle: string, baseUrl?: string): string {
  const slug = normalizeGoFastWithMeSlug(handle);
  const base = (baseUrl ?? getCoachPublicBaseUrl()).replace(/\/$/, '');
  return `${base}/coach/${encodeURIComponent(slug)}`;
}
