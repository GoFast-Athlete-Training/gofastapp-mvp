import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';

/** Retired `/gofast-with/*` routes redirect to public runner landing (domain/slug). */
export function gofastWithLegacyRedirectUrl(handle: string): string {
  return runnerPublicLandingUrl(handle.trim());
}
